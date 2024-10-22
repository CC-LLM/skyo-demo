const express = require('express');
const app = express();
const port = 8081;

// 提供静态文件（前端页面）
app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
});

