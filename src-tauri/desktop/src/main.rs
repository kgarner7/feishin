// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod routers;

use std::sync::Arc;

use routers::mpv::mpv_router;
use rspc::{Config, Router};
use shared::{self, new_context, new_router};

#[tokio::main]
async fn main() {
    let context = Arc::new(new_context());

    let router = new_router()
        .config(
            Config::new()
                .set_ts_bindings_header("/* eslint-disable */")
                .export_ts_bindings("../../src/generated/tauri.ts"),
        )
        .middleware(|mw| {
            mw.middleware(|mw| async move {
                let state = (mw.req.clone(), mw.input.clone());
                Ok(mw.with_state(state))
            })
            .resp(|state, result| async move {
                println!(
                    "[LOG] req='{:?}' input='{:?}' result='{:?}'",
                    state.0, state.1, result
                );
                Ok(result)
            })
        })
        .merge("mpv.", mpv_router())
        .build();

    tauri::Builder::default()
        .plugin(rspc_tauri::plugin(router.arced(), move |_| context.clone()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
