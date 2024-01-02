# cloudflare-safeproxy
cloudflare全能加密安全代理，给你的cloudflare代理设置一个密码，避免被恶意刷流量和一些不安全的代理访问

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
