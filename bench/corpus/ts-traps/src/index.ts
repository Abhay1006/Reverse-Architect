import { route } from './router';
import { log } from './services/logger';

route('/about').then(log);
