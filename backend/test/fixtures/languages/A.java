package com.example;

import com.example.model.User;

public class Service extends Base implements Runnable {
    public void run() {
        if (true) { helper(); }
    }
    private void helper() {}
}
interface Repo { void save(); }
