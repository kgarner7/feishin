#[cfg(feature = "desktop")]
use libmpv2::{Error as MpvE, Mpv};

use std::sync::Arc;

use rspc::{Router, RouterBuilder};
use tokio::sync::Mutex;

pub struct FeishinContext {
    #[cfg(feature = "desktop")]
    pub mpv: Option<Arc<Mutex<Mpv>>>,
}

pub type FeishinRouter = RouterBuilder<Arc<FeishinContext>>;

#[cfg(feature = "desktop")]
pub fn new_context() -> FeishinContext {
    match Mpv::new() {
        Ok(mpv) => FeishinContext {
            mpv: Some(Arc::new(Mutex::new(mpv))),
        },
        Err(error) => {
            println!("Failed to initialize mpv: {:?}", error);
            FeishinContext { mpv: None }
        }
    }
}

#[cfg(not(feature = "desktop"))]
pub fn new_context() -> FeishinContext {
    FeishinContext {}
}

pub fn new_router() -> FeishinRouter {
    Router::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
