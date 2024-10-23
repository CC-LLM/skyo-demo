# skyo-demo
demo of skyo 

## front end
### 用npm初始化,  且安装js需要的包
- npm init -y
- npm install express

### 修改public/app.js里的skyoUrl地址为skyo server ip和端口(通常会配置nginx proxy暴露对外端口,  需要的时候可以单独咨询@hector), 然后启动前端: node server.js

## skyo inference backend
参考 https://github.com/CC-LLM/megatron-lm/commit/830bca16874e383b1c6d6d82a2c8999f967f9312 readme

