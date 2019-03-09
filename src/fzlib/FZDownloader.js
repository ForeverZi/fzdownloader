/**
 * @author ForeverZi
 * @email txzm2018@gmail.com
 * @create date 2019-03-09 23:18:38
 * @modify date 2019-03-09 23:18:38
 * @desc [description]
 */
import { ZIP_DISABLE_SIZE } from '../fzconf';
const dirCache = {};

class FZDownloader {

    constructor(maxPipCount, progressCb, completCb) {
        this.maxPipCount = maxPipCount;
        this.progressCb = progressCb;
        this.completCb = completCb;
        let remoteServeRoot = wxDownloader.REMOTE_SERVER_ROOT;
        if (remoteServeRoot && remoteServeRoot.endsWith('/')) {
            remoteServeRoot = remoteServeRoot.slice(0, -1);
        }
        this.urlPrefix = remoteServeRoot;
    }

    start() {
        const fsm = wx.getFileSystemManager();
        // 读取清单文件
        fsm.readFile({
            filePath: 'res/manifest.json',
            encoding: 'utf8',
            success: res => {
                const manifestInfo = JSON.parse(res.data);
                this.manifestInfo = manifestInfo;
                this.startFlow(manifestInfo);
            },
            fail: () => {
                console.warn('无法获取清单文件,结束下载流程');
                this.onCompleted();
            }
        });
    }

    startFlow(manifestInfo) {
        const fsm = wx.getFileSystemManager();
        fsm.stat({
            path: wx.env.USER_DATA_PATH,
            recursive: true,
            success: (res) => {
                const getObjSize = (obj) => {
                    if (typeof obj !== 'object') {
                        return 0;
                    }
                    if (typeof obj.size === 'number') {
                        return obj.size;
                    }
                    if (obj.stats) {
                        return getObjSize(obj.stats);
                    }
                    return Object.values(obj).reduce((acc, v) => acc + getObjSize(v), 0);
                }
                // 如果本地缓存大于ZIP_DISABLE_SIZE不使用zip渠道
                const totalSize = getObjSize(res.stats);
                if (totalSize >= ZIP_DISABLE_SIZE) {
                    this.normalFlow(manifestInfo);
                } else {
                    this.zipFlow(manifestInfo);
                }
            },
            fail: () => {
                console.warn('获取缓存大小错误');
                reject();
            }
        });
    }

    zipFlow(manifestInfo) {
        const duzipP = this.downloadAndUnzip(manifestInfo.zipfile);
        duzipP.then(() => {
            this.onCompleted();
        }).catch(() => this.normalFlow(manifestInfo));
    }

    normalFlow(manifestInfo) {
        const files = manifestInfo && manifestInfo.files;
        if (!files || files.length < 1) {
            this.onCompleted();
            return;
        }
        let processCount = 0;
        const totalCount = files.length;
        const self = this;
        function handle() {
            if(files.length < 1){
                return;
            }
            const filePath = "res" + files.pop();
            const isLast = files.length === 0;
            self.existPromise(filePath).then(() => { }, () => {
                return self.downloadFilePromise(filePath);
            }).catch(() => { 
                console.warn('下载失败:', filePath) 
            }).finally(() => {
                processCount++;
                self.onProgressUpdate(processCount / totalCount * 100);
                if(isLast){
                    this.onCompleted();
                }else{
                    handle(files);
                }
            });
        }
        const pipeCount = Math.max(1, Math.min(files.length, this.maxPipCount));
        for (let i = 0; i < pipeCount; i++) {
            handle();
        }
    }

    onUpdateProgress(progress) {
        if (this.progressCb && typeof this.progressCb === 'function') {
            this.progressCb(progress);
        }
    }

    onCompleted() {
        if (this.completCb && typeof this.completCb === 'function') {
            this.completCb();
        }
    }

    downloadAndUnzip(zipfile) {
        return new Promise((resolve, reject) => {
            console.warn("开始下载zip:", this.getRemotePath(zipfile));
            const task = wx.downloadFile({
                url: this.getRemotePath(zipfile),
                success: (res) => {
                    if (res.statusCode === 200) {
                        const fsm = wx.getFileSystemManager();
                        fsm.unzip({
                            zipFilePath: res.tempFilePath,
                            targetPath: this.getLocalPath("/res"),
                            success: () => {
                                resolve();
                            },
                            fail: () => {
                                console.warn('解压失败');
                                reject();
                            },
                        });
                    } else {
                        console.warn('服务端zip文件缺失:', zipfile);
                        reject();
                    }
                },
                fail: () => {
                    console.warn('下载zip文件失败');
                    reject();
                }
            });
            task.onProgressUpdate((res) => {
                this.onUpdateProgress(res.progress);
            });
        });
    }

    getRemotePath(path) {
        if (path.startsWith('/')) {
            return this.urlPrefix + path;
        } else {
            return this.urlPrefix + '/' + path;
        }
    }

    dirname(path){
        const paths = path.split('/');
        paths.pop();
        return paths.join('/');
    }

    ensureDirFor(path, callback) {
        var ensureDir = this.dirname(path);
        if (ensureDir === wx.env.USER_DATA_PATH) {
            callback();
            return;
        }
        if (dirCache[path]) {
            callback();
            return;
        }
        wx.getFileSystemManager().access({
            path: ensureDir,
            success: () => {
                dirCache[path] = true;
                callback();
            },
            fail: () => {
                this.ensureDirFor(ensureDir, function () {
                    wx.getFileSystemManager().mkdir({
                        dirPath: ensureDir,
                        complete: () => {
                            dirCache[path] = true;
                            callback();
                        }
                    });
                });
            }
        });
    }

    existPromise(path) {
        return new Promise((resolve, reject) => {
            const localPath = this.getLocalPath(path);
            wx.getFileSystemManager().access({
                path: localPath,
                success: () => {
                    resolve(path);
                },
                fail: () => {
                    reject(path);
                }
            });
        });
    }

    downloadFilePromise(path) {
        const remoteUrl = this.getRemotePath(path);
        return new Promise((resolve, reject) => {
            wx.downloadFile({
                url: remoteUrl,
                success: res => {
                    if (res.statusCode === 404) {
                        reject(res);
                    } else if (res.tempFilePath) {
                        const localPath = this.getLocalPath(path);
                        this.ensureDirFor(localPath, () => {
                            wx.saveFile({
                                tempFilePath: res.tempFilePath,
                                filePath: localPath,
                                success: res => {
                                    resolve();
                                },
                                fail: res => {
                                    reject(res);
                                }
                            });
                        });
                    }
                },
                fail: res => {
                    reject(res);
                }
            });
        });
    }

}

export default FZDownloader;