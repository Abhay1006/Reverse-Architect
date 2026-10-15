from inventory.storage.registry import Registry
from inventory.notify.dispatcher import EventDispatcher
from inventory.models import Item
from inventory.pricing import PriceCalculatorFactory


def run():
    registry = Registry.get_instance()
    dispatcher = EventDispatcher()
    dispatcher.subscribe("added", print)
    calc = PriceCalculatorFactory.create_calculator("retail")
    item = Item("widget", calc.price(10))
    registry.add(item)
    dispatcher.notify("added", item)
