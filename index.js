if (process.env.ENVIRONMENT != 'PROD') {
  require('dotenv').config();
}
const app = require("./server");
const port = 8000;

// Start server
app.listen(process.env.PORT || port, () => console.log('Listening on port ' + port));
