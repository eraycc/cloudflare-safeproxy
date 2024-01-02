# cloudflare-safeproxy
cloudflare全能加密安全代理，给你的cloudflare代理设置一个密码，避免被恶意刷流量和一些不安全的代理访问
## 项目背景
- 之前使用cloudflare代理，因为没有加以安全限制，被检测出代理的地址：gitxxx.xx/login,（可能经人工审核之后）认为是钓鱼，所以封禁了cloudflare账号，不得已只能申诉，痛！如果通过本项目设置了简单的密码验证之后，人工审核未经过密码验证时会自动引导到密码页，避免被审核为钓鱼网站被封禁域名和账号，同时也可以避免一些滥用盗刷流量
## name cloudflare安全代理
## author: eray
## version: v1.0
## blog: blog.eray.cc
## email: admin@eray.cc
## desp: 本项目可以给cf代理设置一个密码，使代理更安全，调用更方便

# config set:
## 需要替换：
### 密码验证路径（可选）：
```
/your-pwd-verify-path
```
### 越权Api代理前缀路径[用于代理openai等api]（可以直接注释删除，不使用）:
```
/your-safe-api-prefix/
```
### 访问密码（推荐设置复杂一些）：
```
your-access-pwd
```
# deploy
- 注册cloudflare
- 绑定一个域名
- 创建workers route
- 复制并修改本项目中的worker.js代码
- deploy and enjoy it

# 本项目基于以下项目修改：
https://github.com/gaboolic/cloudflare-reverse-proxy
