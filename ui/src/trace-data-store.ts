class TraceDataStore {
  getData(query: {process: string, thread: string, start: number, end: number}) {
    // Use query to get some data
    console.log(query);
  }
  onNewDataReceived() {
    //App.render();
  }
}
