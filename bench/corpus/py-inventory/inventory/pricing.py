class RetailCalculator:
    def price(self, base):
        return base * 1.2


class WholesaleCalculator:
    def price(self, base):
        return base * 0.9


class PriceCalculatorFactory:
    @staticmethod
    def create_calculator(kind):
        if kind == "retail":
            return RetailCalculator()
        return WholesaleCalculator()
