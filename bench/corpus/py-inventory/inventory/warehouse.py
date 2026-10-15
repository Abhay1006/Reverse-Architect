from inventory.models import Item


class Warehouse:
    def __init__(self):
        self.items = []

    def receive(self, item: Item):
        self.items.append(item)
        item.assign(self)
