from inventory.warehouse import Warehouse


class Item:
    def __init__(self, name, price):
        self.name = name
        self.price = price
        self.warehouse = None

    def assign(self, warehouse: Warehouse):
        self.warehouse = warehouse
