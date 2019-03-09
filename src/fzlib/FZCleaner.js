/**
 * @author ForeverZi
 * @email txzm2018@gmail.com
 * @create date 2019-03-09 22:18:55
 * @modify date 2019-03-09 22:18:55
 * @desc [description]
 */
class FZCleaner {

    constructor() {
        const fsm = wx.getFileSystemManager();
        this.fsm = fsm;
    }

    clean() {
        // 读取清单文件
        this.fsm.readFile({
            filePath: 'res/manifest.json',
            encoding: 'utf8',
            success: res => {
                const obj = JSON.parse(res.data);
                const tree = this.genFilesTree(obj.files);
                this.cleanRes(tree);
            },
            fail: () => {
                console.warn('找不到清单文件,保留文件树生成失败');
            }
        });
    }

    cleanRes(tree) {
        let curDir = this.getLocalPath('res');
        this.cleanDir(curDir, tree);
    }

    cleanDir(dirPath, tree) {
        this.fsm.readdir({
            dirPath: dirPath,
            success: (res) => {
                for (const file of res.files) {
                    const path = dirPath + '/' + file;
                    if (!tree[file]) {
                        this.rmPath(path)
                    } else {
                        this.tryCleanPath(path, tree[file]);
                    }
                }
            }
        });
    }

    tryCleanPath(path, tree) {
        this.fsm.stat({
            path: path,
            success: (res) => {
                const stat = res.stats;
                if (stat.isDirectory()) {
                    this.cleanDir(path, tree);
                }
            }
        });
    }

    rmPath(path) {
        this.fsm.stat({
            path: path,
            success: (res) => {
                const stat = res.stats;
                if (stat.isDirectory()) {
                    this.fsm.rmdir({ dirPath: path });
                } else {
                    this.fsm.unlink({ filePath: path });
                }
            }
        });
    }

    getLocalPath(path) {
        if (path[0].startsWith('/')) {
            return wx.env.USER_DATA_PATH + path;
        } else {
            return wx.env.USER_DATA_PATH + '/' + path;
        }
    }

    genFilesTree(files) {
        const tree = {};
        for (const file of files) {
            const paths = file.slice(1).split('/');
            this.setTree(tree, paths);
        }
        return tree;
    }

    setTree(tree, paths) {
        const file = paths[paths.length - 1];
        let cur = tree;
        for (const path of paths) {
            if (path === file) {
                cur[path] = true;
            } else {
                cur[path] = cur[path] || {};
                cur = cur[path]
            }
        }
    }

}

export default FZCleaner;