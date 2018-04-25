import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import Hello from './containers/Hello';
import './index.css';
import { enthusiasm } from './reducers';
import registerServiceWorker from './registerServiceWorker';

const store = createStore(enthusiasm, {
  enthusiasmLevel: 1,
  languageName: 'Perfetto',
});

ReactDOM.render(
    <Provider store={store}>
      <Hello />
    </Provider>,
  document.getElementById('root') as HTMLElement  // What is this?
);
registerServiceWorker();
