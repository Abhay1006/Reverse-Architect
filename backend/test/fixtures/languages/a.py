from app.models import User, Order
import os

class Service(Base):
    def run(self, x):
        if x:
            return helper(x)

def helper(x):
    return x
