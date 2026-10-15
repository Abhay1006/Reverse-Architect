class Registry:
    _instance = None

    def __init__(self):
        self.items = []

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = Registry()
        return cls._instance

    def add(self, item):
        self.items.append(item)
