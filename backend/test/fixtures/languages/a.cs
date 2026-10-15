using App.Models;

public class Service : Base, IRunner {
    public void Run(int x) { if (x > 0) Helper(); }
}
public interface IRunner { void Run(int x); }
