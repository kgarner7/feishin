use std::{collections::HashMap, default, fmt::format, future::Future, sync::Arc};

use shared::{new_router, FeishinContext, FeishinRouter};

use libmpv2::{
    events::{Event, EventContext},
    Error as MpvError, FileState, Mpv,
};
use rspc::{Error as RspcError, ErrorCode};
use serde::Deserialize;
use specta::Type;
use tauri::async_runtime::handle;
use tokio::sync::MutexGuard;

fn bad_request<T>(err: String) -> Result<T, RspcError> {
    return Err(RspcError::new(ErrorCode::BadRequest, err));
}

async fn mpv_handler<O>(
    ctx: &FeishinContext,
    mut handler: impl FnMut(MutexGuard<Mpv>) -> Result<O, MpvError>,
) -> Result<O, RspcError> {
    if let Some(mpv) = &ctx.mpv {
        let clone = mpv.clone();
        let locked = clone.lock().await;

        Ok(handler(locked)
            .map_err(|error| RspcError::new(ErrorCode::InternalServerError, error.to_string()))?)
    } else {
        bad_request(String::from("Mpv not available"))
    }
}

#[derive(Deserialize, Type)]
struct QueueState {
    current: Option<String>,
    next: Option<String>,
    pause: Option<bool>,
}

pub fn mpv_router() -> FeishinRouter {
    let router = new_router();

    router
        .query("time", |t| {
            t(|ctx, _: ()| async move {
                mpv_handler(&ctx, |mpv| {
                    Ok(mpv.get_internal_time() as f64 / 1_000_000_f64)
                })
                .await
            })
        })
        .mutation("auto-next", |t| {
            t(|ctx, next: Option<String>| async move {
                mpv_handler(&ctx, |mpv| {
                    if let Err(error) = mpv.playlist_remove_index(0) {
                        mpv.pause()?;
                        return Err(error)
                    }

                    if let Some(next_item) = &next {
                        mpv.playlist_load_files(&[(next_item, FileState::Append, None)])?;
                    }

                    Ok(())
                }).await
            })
        })
        .mutation("initialize", |t| {
            t(|ctx, _a: ()| async move {
                mpv_handler(&ctx, |mpv| {
                    mpv.set_property("idle", true)?;
                    mpv.set_property("video", false)?;
                    mpv.set_property("audio-display", false)?;
                    // mpv.set_property("no-video", true)?;
                    // mpv.set_property("no-audio-display", true)
                    // mpv.playlist_load_files(&[("https://noproxy-music.kendallgarner.com/rest/stream?u=me%40kendallgarner.com&t=4f1c0df45ecc4168639916dc377646b8&s=ce63e6&f=json&v=1.8.0&c=NavidromeUI&id=3392120edb902ffa2d852a8758a274e4&_=1715409320383", libmpv2::FileState::AppendPlay, None)])
                    Ok(())
                })
                .await
            })
        })
        .mutation("mute", |t| {
            t(|ctx, mute: bool| async move {
                mpv_handler(&ctx, |mpv| mpv.set_property("mute", mute)).await
            })
        })
        .mutation("next", |t| {
            t(|ctx, _: ()| async move {
                mpv_handler(&ctx, |mpv| mpv.playlist_next_weak()).await
            })
        })
        .mutation("pause", |t| {
            t(|ctx, _: ()| async move {
                mpv_handler(&ctx, |mpv| mpv.pause()).await
            })
        })
        .mutation("play", |t| {
            t(|ctx, _: ()| async move {
                mpv_handler(&ctx, |mpv| play(&mpv)).await
            })
        })
        .mutation("previous", |t| {
            t(|ctx, _: ()| async move {
                mpv_handler(&ctx, |mpv| mpv.playlist_previous_weak()).await
            })
        })
        .mutation("quit", |t| {
            t(|ctx, _: ()| async move {
                mpv_handler(&ctx, |mpv| mpv.command("quit", &[])).await
            })
        })
        .mutation("seek", |t| {
            t(|ctx, offset: f64| async move {
                mpv_handler(&ctx, |mpv| mpv.seek_forward(offset)).await
            })
        })
        .mutation("seek-to", |t| {
            t(|ctx, secs: f64| async move {
                mpv_handler(&ctx, |mpv| mpv.seek_absolute(secs)).await
            })
        })
        .mutation("set-properties", |t| {
            t(|ctx, properties: HashMap<String, String>|  async move{
                if properties.len() == 0 {
                    return Ok(())
                }

                mpv_handler(&ctx, |mpv| {
                    for (property, value) in &properties {
                        mpv.set_property(property.as_str(), value.as_str())?;
                    }

                    Ok(())
                }).await
            })
        })
        .mutation("set-queue", |t| {
            t(|ctx, queue: QueueState| async move{
                if queue.current == None && queue.next != None {
                    return bad_request(String::from("Must pass in song to queue now"));
                }

                mpv_handler(&ctx, |mpv| {
                    if queue.current == None && queue.next == None {
                        mpv.playlist_clear()?;
                        return mpv.pause();
                    }

                    let current_binding = queue.current.as_ref().unwrap().as_str();
                    let mut songs = vec![(current_binding, FileState::Replace, None)];

                    if let Some(next) = &queue.next {
                        songs.push((next.as_str(), FileState::Append, None));
                    }

                    if let Err(error) = mpv.playlist_load_files(&songs) {
                        play(&mpv)?;
                    }

                    match queue.pause {
                        Some(true) => mpv.pause(),
                        Some(false) => play(&mpv),
                        default => Ok(())
                    }
                }).await
            })
        })
        .mutation("set-queue-next", |t| {
            t(|ctx, next: Option<String>| async move{
                mpv_handler(&ctx, |mpv| {
                    let size: i64 = mpv.get_property("playlist-count")?;

                    if size < 1 {
                        return Ok(())
                    }

                    if size > 1 {
                        mpv.playlist_remove_index(1)?;
                    }

                    if let Some(next_item) = &next {
                        mpv.playlist_load_files(&[(next_item, FileState::Append, None)])?;
                    }

                    Ok(())
                }).await
            })
        })
        .mutation("stop", |t| {
            t(|ctx, _: ()| async move{
                mpv_handler(&ctx, |mpv| {
                    mpv.command("stop", &[])
                }).await
            })
        })
        .mutation("volume", |t| {
            t(|ctx, volume: i32| async move {
                if volume < 0 || volume > 100 {
                    return bad_request(format!("Volume {} must be in range [0, 100]", volume));
                }

                mpv_handler(&ctx, |mpv| mpv.set_property("volume", volume as i64)).await
            })
        })
        .subscription("status", |t| t(|ctx, _: ()| async_stream::stream! {
            let mut ctx = if let Some(mpv) = &ctx.mpv {
                let clone = mpv.clone();
                let locked = clone.lock().await;
        

                EventContext::new(locked.ctx.clone())
            } else {
                return
            };

            while true {
                if let Some(event) = ctx.wait_event(0.0) {
                    println!("{:?}", event);
                }
            }

        }))
}

fn play(mpv: &MutexGuard<Mpv>) -> Result<(), MpvError> {
    let idle: bool = mpv.get_property("idle-active")?;
    let playlist_size: i64 = mpv.get_property("playlist-count")?;

    if (idle && playlist_size > 0) {
        let mut context = EventContext::new(mpv.ctx);

        context.enable_all_events()?;
        let mut started = false;

        let mut count = 0;

        mpv.command("play", &[])?;

        while true {
            if let Some(message) = context.wait_event(0.01) {
                match message {
                    Err(error) => return Err(error),
                    Ok(event) => match event {
                        Event::StartFile => {
                            started = true;
                        }
                        Event::FileLoaded => {
                            if started {
                                return Ok(());
                            }
                        }
                        Event::EndFile(_file) => return Err(MpvError::Raw(10)),
                        _ => {}
                    },
                }
            }

            count += 1;
            if count == 100 {
                break;
            }
        }

        return Err(MpvError::Raw(10));
    } else {
        mpv.unpause()
    }
}
