import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import Hello from './containers/Hello';
import './index.css';
import { enthusiasm } from './reducers';
import registerServiceWorker from './registerServiceWorker';

// Force any on window.
const windowAny: any = window;

const store = createStore(enthusiasm, {
    enthusiasmLevel: 1,
    languageName: 'Perfetto',
},
windowAny.__REDUX_DEVTOOLS_EXTENSION__ && windowAny.__REDUX_DEVTOOLS_EXTENSION__());

ReactDOM.render(
    <Provider store={store}>
      <Hello />
    </Provider>,
  document.getElementById('root')
);
registerServiceWorker();
