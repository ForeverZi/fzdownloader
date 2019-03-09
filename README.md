# FZDownload
## 概述
微信小游戏远程资源下载管理器
## 示例
使用方法
```js
import FZCleaner from 'fzlib/FZCleaner';
import FZDownloader from 'fzlib/FZDownloader';

const cleaner = new FZCleaner();
const downloader = new FZDownloader(8, (progress)=>console.log(progress), ()=>console.log('downloader completed'));

cleaner.clean();
downloader.start();
```