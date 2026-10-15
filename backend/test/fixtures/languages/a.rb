require_relative 'models/user'

class Service < Base
  def run(x)
    helper(x) if x
  end
end
