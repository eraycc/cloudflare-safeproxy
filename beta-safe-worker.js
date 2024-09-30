/*

该代码改自：https://github.com/1234567Yang/cf-proxy-ex
感谢原作者：https://github.com/gaboolic/cloudflare-reverse-proxy

修改内容：
修改了原来的mainPage，增加路径输入框及按钮
修改了判断密码逻辑，开启密码后跳转到密码验证界面
新增了api代理路径
优化代码结构及冗余

config set:(搜索替换)
代理密码：password
api代理路径：your-safe-api-prefix

api代理路径使用：https://domain/your-safe-api-prefix/apiurl

*/

addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  const thisProxyServerUrl_hostOnly = url.host;

  event.respondWith(handleRequest(event.request, thisProxyServerUrlHttps, thisProxyServerUrl_hostOnly));
});

const str = "/";
const proxyCookie = "__PROXY_VISITEDSITE__";
const passwordCookieName = "__PROXY_PWD__";
const password = "your-proxy-pwd";
const replaceUrlObj = "__location____";

const httpRequestInjection = `
  var now = new URL(window.location.href);
  var base = now.host;
  var protocol = now.protocol;
  var nowlink = protocol + "//" + base + "/";
  var oriUrlStr = window.location.href.substring(nowlink.length);

  function isPosEmbed(html, pos) {
    if (pos > html.length || pos < 0) return false;

    let start = html.lastIndexOf('<', pos);
    if (start === -1) start = 0;

    let end = html.indexOf('>', pos);
    if (end === -1) end = html.length;

    let content = html.slice(start + 1, end);
    if (content.includes(">") || content.includes("<")) {
      return true; // in content
    }
    return false;
  }

  const matchList = [[/href=("|')([^"']*)("|')/g, \`href="\`], [/src=("|')([^"']*)("|')/g, \`src="\`]];
  function bodyCovToAbs(body, requestPathNow) {
    var original = [];
    var target = [];

    for (var match of matchList) {
      var setAttr = body.matchAll(match[0]);
      if (setAttr != null) {
        for (var replace of setAttr) {
          if (replace.length == 0) continue;
          var strReplace = replace[0];
          if (!strReplace.includes(base)) {
            if (!isPosEmbed(body, replace.index)) {
              var relativePath = strReplace.substring(match[1].toString().length, strReplace.length - 1);
              if (!relativePath.startsWith("data:") && !relativePath.startsWith("javascript:") && !relativePath.startsWith("chrome") && !relativePath.startsWith("edge")) {
                try {
                  var absolutePath = nowlink + new URL(relativePath, requestPathNow).href;
                  original.push(strReplace);
                  target.push(match[1].toString() + absolutePath + \`"\`);
                } catch {
                  // 无视
                }
              }
            }
          }
        }
      }
    }
    for (var i = 0; i < original.length; i++) {
      body = body.replace(original[i], target[i]);
    }
    return body;
  }

  function removeIntegrityAttributes(body) {
    return body.replace(/integrity=("|')([^"']*)("|')/g, '');
  }

  function nthIndex(str, pat, n){
    var L= str.length, i= -1;
    while(n-- && i++<L){
        i= str.indexOf(pat, i);
        if (i < 0) break;
    }
    return i;
  }

  function ReplaceContent(newContent) {
    document.open();
    document.write(newContent);
    document.close();
  }

  var injectJs = \`
    var now = new URL(window.location.href);
    var base = now.host;
    var protocol = now.protocol;
    var nowlink = protocol + "//" + base + "/";
    var oriUrlStr = window.location.href.substring(nowlink.length);
    var oriUrl = new URL(oriUrlStr);

    var path = now.pathname.substring(1);
    if(!path.startsWith("http")) path = "https://" + path;

    var original_host = path.substring(path.indexOf("://") + "://".length);
    original_host = original_host.split('/')[0];
    var mainOnly = path.substring(0, path.indexOf("://")) + "://" + original_host + "/";

    function changeURL(relativePath){
      try{
        if(relativePath && relativePath.startsWith(nowlink)) relativePath = relativePath.substring(nowlink.length);
        if(relativePath && relativePath.startsWith(base + "/")) relativePath = relativePath.substring(base.length + 1);
        if(relativePath && relativePath.startsWith(base)) relativePath = relativePath.substring(base.length);
      }catch{
        //ignore
      }
      try {
        var absolutePath = new URL(relativePath, path).href;
        absolutePath = absolutePath.replace(window.location.href, path);
        absolutePath = absolutePath.replace(encodeURI(window.location.href), path);
        absolutePath = absolutePath.replace(encodeURIComponent(window.location.href), path);

        absolutePath = absolutePath.replace(nowlink, mainOnly);
        absolutePath = absolutePath.replace(nowlink, encodeURI(mainOnly));
        absolutePath = absolutePath.replace(nowlink, encodeURIComponent(mainOnly));

        absolutePath = absolutePath.replace(nowlink, mainOnly.substring(0,mainOnly.length - 1));
        absolutePath = absolutePath.replace(nowlink, encodeURI(mainOnly.substring(0,mainOnly.length - 1)));
        absolutePath = absolutePath.replace(nowlink, encodeURIComponent(mainOnly.substring(0,mainOnly.length - 1)));

        absolutePath = absolutePath.replace(base, original_host);

        absolutePath = nowlink + absolutePath;
        return absolutePath;
      } catch (e) {
        console.log(path + "   " + relativePath);
        return "";
      }
    }

    function networkInject(){
      var originalOpen = XMLHttpRequest.prototype.open;
      var originalFetch = window.fetch;
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        url = changeURL(url);
        return originalOpen.apply(this, arguments);
      };

      window.fetch = function(input, init) {
        var url;
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof Request) {
          url = input.url;
        } else {
          url = input;
        }

        url = changeURL(url);

        if (typeof input === 'string') {
          return originalFetch(url, init);
        } else {
          const newRequest = new Request(url, input);
          return originalFetch(newRequest, init);
        }
      };
    }

    function windowOpenInject(){
      const originalOpen = window.open;
      window.open = function (url, name, specs) {
          let modifiedUrl = changeURL(url);
          return originalOpen.call(window, modifiedUrl, name, specs);
      };
    }

    class ProxyLocation {
      constructor(originalLocation) {
          this.originalLocation = originalLocation;
      }

      reload(forcedReload) {
          this.originalLocation.reload(forcedReload);
      }

      replace(url) {
          this.originalLocation.replace(changeURL(url));
      }

      assign(url) {
          this.originalLocation.assign(changeURL(url));
      }

      get href() {
          return oriUrlStr;
      }

      set href(url) {
          this.originalLocation.href = changeURL(url);
      }

      get protocol() {
          return this.originalLocation.protocol;
      }

      set protocol(value) {
          this.originalLocation.protocol = changeURL(value);
      }

      get host() {
          return original_host;
      }

      set host(value) {
          this.originalLocation.host = changeURL(value);
      }

      get hostname() {
          return oriUrl.hostname;
      }

      set hostname(value) {
          this.originalLocation.hostname = changeURL(value);
      }

      get port() {
        return oriUrl.port;
      }

      set port(value) {
          this.originalLocation.port = value;
      }

      get pathname() {
        return oriUrl.pathname;
      }

      set pathname(value) {
          this.originalLocation.pathname = value;
      }

      get search() {
        return oriUrl.search;
      }

      set search(value) {
          this.originalLocation.search = value;
      }

      get hash() {
          return oriUrl.hash;
      }

      set hash(value) {
          this.originalLocation.hash = value;
      }

      get origin() {
          return oriUrl.origin;
      }
    }

    function documentLocationInject(){
      Object.defineProperty(document, 'URL', {
        get: function () {
            return oriUrlStr;
        },
        set: function (url) {
            document.URL = changeURL(url);
        }
      });

      Object.defineProperty(document, '${replaceUrlObj}', {
            get: function () {
                return new ProxyLocation(window.location);
            },
            set: function (url) {
                window.location.href = changeURL(url);
            }
      });
    }

    function windowLocationInject() {
      Object.defineProperty(window, '${replaceUrlObj}', {
          get: function () {
              return new ProxyLocation(window.location);
          },
          set: function (url) {
              window.location.href = changeURL(url);
          }
      });
    }

    function historyInject(){
      const originalPushState = History.prototype.pushState;
      const originalReplaceState = History.prototype.replaceState;

      History.prototype.pushState = function (state, title, url) {
        var u = new URL(url, now.href).href;
        return originalPushState.apply(this, [state, title, u]);
      };
      History.prototype.replaceState = function (state, title, url) {
        var u = new URL(url, now.href).href;
        return originalReplaceState.apply(this, [state, title, u]);
      };
    }

    function obsPage() {
      if (document.body) {
        var yProxyObserver = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            traverseAndConvert(mutation);
          });
        });
        var config = { attributes: true, childList: true, subtree: true };
        yProxyObserver.observe(document.body, config);
      } else {
        console.error("obsPage - document.body is not available.");
      }
    }

    function traverseAndConvert(node) {
      if (node instanceof HTMLElement) {
        removeIntegrityAttributesFromElement(node);
        covToAbs(node);
        node.querySelectorAll('*').forEach(function(child) {
          removeIntegrityAttributesFromElement(child);
          covToAbs(child);
        });
      }
    }

    function covToAbs(element) {
      var relativePath = "";
      var setAttr = "";
      if (element instanceof HTMLElement && element.hasAttribute("href")) {
        relativePath = element.getAttribute("href");
        setAttr = "href";
      }
      if (element instanceof HTMLElement && element.hasAttribute("src")) {
        relativePath = element.getAttribute("src");
        setAttr = "src";
      }

      if (setAttr !== "" && relativePath.indexOf(nowlink) != 0) { 
        if (!relativePath.includes("*")) {
          if (!relativePath.startsWith("data:") && !relativePath.startsWith("javascript:") && !relativePath.startsWith("chrome") && !relativePath.startsWith("edge")) {
            try {
              var absolutePath = changeURL(relativePath);
              element.setAttribute(setAttr, absolutePath);
            } catch (e) {
              console.log(path + "   " + relativePath);
            }
          }
        }
      }
    }

    function removeIntegrityAttributesFromElement(element){
      if (element.hasAttribute('integrity')) {
        element.removeAttribute('integrity');
      }
    }

    function loopAndConvertToAbs(){
      for(var ele of document.querySelectorAll('*')){
        removeIntegrityAttributesFromElement(ele);
        covToAbs(ele);
      }
    }

    function covScript(){
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i++) {
        covToAbs(scripts[i]);
      }
      setTimeout(covScript, 3000);
    }

    networkInject();
    windowOpenInject();
    documentLocationInject();
    windowLocationInject();
    historyInject();

    document.addEventListener('DOMContentLoaded', function() {
      loopAndConvertToAbs();
      obsPage();
      covScript();
    });

    window.addEventListener('error', event => {
      var element = event.target || event.srcElement;
      if (element.tagName === 'SCRIPT') {
        covToAbs(element);
        var newScript = document.createElement('script');
        newScript.src = element.src;
        document.head.appendChild(newScript);
      }
    }, true);
  \`;

  fetch(window.location.href, {
    method: 'GET',
    headers: {
      'real_req': '1'
    }
  })
    .then(response => response.text())
    .then(data => {
      var wholepage = data;
      var bd = wholepage.substring(wholepage.indexOf("<" + "!--***SCRIPT INJECT STOP HERE***-->"));
    
      bd = bodyCovToAbs(bd, oriUrlStr);
      bd = removeIntegrityAttributes(bd);
      ReplaceContent("<" + "script>" + injectJs + "<" + "/script>" + bd);
    })
    .catch(error => {
      console.error('Error while sending request:', error);
    });
`;

const mainPage = `
<html lang="zh-CN">
<head>
<style>
body {
  background-color: #fbfbfb;
  font-family: Arial, sans-serif;
}

h1 {
  text-align: center;
  color: #444;
}

.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

form {
  background-color: white;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
  padding: 2rem;
  border-radius: 8px;
}

input {
  display: block;
  width: 100%;
  font-size: 18px;
  padding: 15px;
  border: solid 1px #ccc;
  border-radius: 4px;
  margin: 1rem 0;
}

button {
  padding: 15px;
  background-color: #0288d1;
  color: white;
  font-size: 18px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
}

button:hover {
  background-color: #039BE5;
}
</style>
  <meta charset="UTF-8">
  <title>安全访问</title>
</head>
<body>
  <h1>请输入安全访问路径</h1>
  <form id="proxy-form">
    <input type="text" id="url" name="url" placeholder="请输入路径" required />
    <button type="submit">安全访问</button>
  </form>
  <script>
    const form = document.getElementById('proxy-form');
    form.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('url');
      const actualUrl = input.value;
      const proxyUrl = '/' + actualUrl;
      location.href = proxyUrl;
    });
  </script>
</body>
</html>
`;

const passwordVerificationPage = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<style>
body {
  background-color: #fbfbfb;
  font-family: Arial, sans-serif;
}

h1 {
  text-align: center;
  color: #444;
}

.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

form {
  background-color: white;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
  padding: 2rem;
  border-radius: 8px;
}

input {
  display: block;
  width: 100%;
  font-size: 18px;
  padding: 15px;
  border: solid 1px #ccc;
  border-radius: 4px;
  margin: 1rem 0;
}

button {
  padding: 15px;
  background-color: #0288d1;
  color: white;
  font-size: 18px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
 }

button:hover {
  background-color: #039BE5;
}
</style>
  <meta charset="UTF-8">
  <title>密码验证</title>
</head>
<body>
  <h1>密码验证</h1>
  <form id="password-form">
    <input type="password" id="password" name="password" placeholder="请输入访问密码" required />
    <button type="submit">验证密码</button>
  </form>
  <script>
    const form = document.getElementById('password-form');
    form.addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('password');
      const password = input.value;

      fetch('/verify-password', { method: 'POST', body: password })
        .then(response => response.text())
        .then(result => {
          if (result === 'success') {
            document.cookie = '__PROXY_PWD__=' + password + '; expires=' + new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
            location.href = '/';
          } else {
            alert('密码验证失败！');
          }
        });
    });
  </script>
</body>
</html>
`;

const redirectError = `
<html><head><title>访问出错了！</title></head><body><h2>重定向时出错：要访问的网站可能包含错误的重定向信息，系统无法解析该信息</h2></body></html>
`;

async function handleRequest(request, thisProxyServerUrlHttps, thisProxyServerUrl_hostOnly) {
  const url = new URL(request.url);

  if (url.pathname === '/verify-password') {
    return handlePasswordVerification(request);
  }
  
  //如果不需要该功能可以直接注释掉该判断
  if (url.pathname.includes('/your-safe-api-prefix/')) {
    return handleApiRequest(request);
  }

  const siteCookie = request.headers.get('Cookie');

  if (password !== "") {
    const pwd = getCook(passwordCookieName, siteCookie);
    if (pwd !== password) {
      return getHTMLResponse(passwordVerificationPage);
    }
  }

  if (request.url.endsWith("favicon.ico")) {
    return Response.redirect("https://www.baidu.com/favicon.ico", 301);
  }

  let actualUrlStr = url.pathname.substring(url.pathname.indexOf(str) + str.length) + url.search + url.hash;
  if (actualUrlStr == "") {
    return getHTMLResponse(mainPage);
  }

  try {
    let test = actualUrlStr;
    if (!test.startsWith("http")) {
      test = "https://" + test;
    }
    new URL(test);
  } catch {
    let lastVisit = getCook(proxyCookie, siteCookie);
    if (lastVisit) {
      return Response.redirect(thisProxyServerUrlHttps + lastVisit + "/" + actualUrlStr, 301);
    }
    return getHTMLResponse("Something is wrong while trying to get your cookie: <br> siteCookie: " + siteCookie + "<br>" + "lastSite: " + lastVisit);
  }

  if (!actualUrlStr.startsWith("http") && !actualUrlStr.includes("://")) {
    return Response.redirect(thisProxyServerUrlHttps + "https://" + actualUrlStr, 301);
  }

  const actualUrl = new URL(actualUrlStr);

  let clientHeaderWithChange = new Headers();
  for (let [key, value] of request.headers.entries()) {
    clientHeaderWithChange.set(key, value.replaceAll(thisProxyServerUrlHttps, actualUrlStr).replaceAll(thisProxyServerUrl_hostOnly, actualUrl.host));
  }

  let clientRequestBodyWithChange;
  if (request.body) {
    clientRequestBodyWithChange = await request.text();
    clientRequestBodyWithChange = clientRequestBodyWithChange
      .replaceAll(thisProxyServerUrlHttps, actualUrlStr)
      .replaceAll(thisProxyServerUrl_hostOnly, actualUrl.host);
  }

  const modifiedRequest = new Request(actualUrl, {
    headers: clientHeaderWithChange,
    method: request.method,
    body: (request.body) ? clientRequestBodyWithChange : request.body,
    redirect: "manual"
  });

  const response = await fetch(modifiedRequest);
  if (response.status.toString().startsWith("3") && response.headers.get("Location")) {
    try {
      return Response.redirect(thisProxyServerUrlHttps + new URL(response.headers.get("Location"), actualUrlStr).href, 301);
    } catch {
      return getHTMLResponse(redirectError + "<br>the redirect url:" + response.headers.get("Location") + ";the url you are now at:" + actualUrlStr);
    }
  }

  let modifiedResponse;
  let bd;

  const contentType = response.headers.get("Content-Type");
  if (contentType && contentType.startsWith("text/")) {
    bd = await response.text();

    let regex = new RegExp(`(?<!src="|href=")(https?:\\/\\/[^\s'"]+)`, 'g');
    bd = bd.replace(regex, (match) => {
      if (match.includes("http")) {
        return thisProxyServerUrlHttps + match;
      } else {
        return thisProxyServerUrl_hostOnly + "/" + match;
      }
    });

    if (contentType.includes("text/html") || contentType.includes("text/javascript")) {
      bd = bd.replace("window.location", "window." + replaceUrlObj);
      bd = bd.replace("document.location", "document." + replaceUrlObj);
    }

    if (contentType.includes("text/html") && bd.includes("<html")) {
      if (!request.headers.has('real_req')) {
        return getHTMLResponse("<html><head><script>" + httpRequestInjection + "</script></head></html>");
      }
      bd = "<!--cf-proxy-ex---***SCRIPT INJECT STOP HERE***---github.com/1234567Yang/cf-proxy-ex-->" + bd;
    }

    modifiedResponse = new Response(bd, response);
  } else {
    let blob = await response.blob();
    modifiedResponse = new Response(blob, response);
  }

  let headers = modifiedResponse.headers;
  let cookieHeaders = [];

  for (let [key, value] of headers.entries()) {
    if (key.toLowerCase() == 'set-cookie') {
      cookieHeaders.push({ headerName: key, headerValue: value });
    }
  }

  if (cookieHeaders.length > 0) {
    cookieHeaders.forEach(cookieHeader => {
      let cookies = cookieHeader.headerValue.split(',').map(cookie => cookie.trim());

      for (let i = 0; i < cookies.length; i++) {
        let parts = cookies[i].split(';').map(part => part.trim());

        let pathIndex = parts.findIndex(part => part.toLowerCase().startsWith('path='));
        let originalPath;
        if (pathIndex !== -1) {
          originalPath = parts[pathIndex].substring("path=".length);
        }
        let absolutePath = "/" + new URL(originalPath, actualUrlStr).href;;

        if (pathIndex !== -1) {
          parts[pathIndex] = `Path=${absolutePath}`;
        } else {
          parts.push(`Path=${absolutePath}`);
        }

        let domainIndex = parts.findIndex(part => part.toLowerCase().startsWith('domain='));

        if (domainIndex !== -1) {
          parts[domainIndex] = `domain=${thisProxyServerUrl_hostOnly}`;
        } else {
          parts.push(`domain=${thisProxyServerUrl_hostOnly}`);
        }

        cookies[i] = parts.join('; ');
      }

      headers.set(cookieHeader.headerName, cookies.join(', '));
    });
  }

  if (contentType && contentType.includes("text/html") && response.status == 200 && bd.includes("<html")) {
    let cookieValue = proxyCookie + "=" + actualUrl.origin + "; Path=/; Domain=" + thisProxyServerUrl_hostOnly;
    headers.append("Set-Cookie", cookieValue);
  }

  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  if (modifiedResponse.headers.has("Content-Security-Policy")) {
    modifiedResponse.headers.delete("Content-Security-Policy");
  }
  if (modifiedResponse.headers.has("Permissions-Policy")) {
    modifiedResponse.headers.delete("Permissions-Policy");
  }
  modifiedResponse.headers.set("X-Frame-Options", "ALLOWALL");

  return modifiedResponse;
}

function getCook(cookiename, cookies) {
  let cookiestring = RegExp(cookiename + "=[^;]+").exec(cookies);
  return decodeURIComponent(!!cookiestring ? cookiestring.toString().replace(/^[^=]+./, "") : "");
}

function getHTMLResponse(html) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

async function handlePasswordVerification(request) {
  if (request.method === 'POST') {
    const inputpwd = await request.text();
    if (inputpwd === password) {
      return new Response('success', {
        headers: {
          'Content-Type': 'text/plain'
        },
      });
    } else {
      return new Response('failure', {
        headers: {
          'Content-Type': 'text/plain'
        },
      });
    }
  } else {
    return new Response('Method Not Allowed', { status: 405 });
  }
}

async function handleApiRequest(request) {
  const url = new URL(request.url);
  const actualUrlStr = fixUrl(url.pathname.replace("/your-safe-api-prefix/", "")) + url.search + url.hash;
  const actualUrl = new URL(actualUrlStr);

  const modifiedRequest = new Request(actualUrl, {
    headers: request.headers,
    method: request.method,
    body: request.body,
    redirect: 'follow'
  });

  const response = await fetch(modifiedRequest);
  const modifiedResponse = new Response(response.body, response);

  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');

  return modifiedResponse;
}

function fixUrl(url) {
  if (url.includes("://")) {
    return url;
  } else if (url.includes(':/')) {
    return url.replace(':/', '://');
  } else {
    return "http://" + url;
  }
}