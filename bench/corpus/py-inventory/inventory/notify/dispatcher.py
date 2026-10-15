class EventDispatcher:
    def __init__(self):
        self.listeners = {}

    def subscribe(self, event, listener):
        self.listeners.setdefault(event, []).append(listener)

    def notify(self, event, payload):
        for listener in self.listeners.get(event, []):
            listener(payload)
