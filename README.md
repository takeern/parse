###
> parse 是一个码流封装分析工具。开发目的就是 帮助 js 开发者，分析码流的同时能够非常快速的验证相关问题。

### 安装
```js
// 没有发到 npm 上，需要先clone 再创建软链接

git clone https://github.com/takeern/parse.git

cd parse && npm i && npm link
```

### 使用
``` js

// 展示 10 条 frame 数据
parse -p inputpath.flv -l 10 

// 更多
parse -h
```