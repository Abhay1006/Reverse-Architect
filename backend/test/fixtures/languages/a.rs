use crate::store::{Db, Row};

pub struct Server { db: Db }

pub trait Handler { fn handle(&self); }

impl Server {
    pub fn start(&self) -> bool { if true { return true } false }
}

pub fn new_server() -> Server { Server { db: Db {} } }
