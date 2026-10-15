import com.example.model.User

class Service(val repo: Repo) : Base() {
    fun run(x: Int) { if (x > 0) helper() }
}
interface Repo { fun save() }
