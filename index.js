const app = require("./server");
const port = 8000;

// Start server
const server = require('http').Server(app);
server.listen(process.env.PORT || port, () => console.log('Listening on port ' + port));
