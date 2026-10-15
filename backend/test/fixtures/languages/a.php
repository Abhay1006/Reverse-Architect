<?php
use App\Models\User;

class Service extends Base implements Runner {
    public function run($x) { if ($x) { return $this->helper($x); } }
}
