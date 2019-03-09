#!/bin/sh
#项目路径,shell目录需要放在项目根目录下,或者手动配置此变量
projpath=$(cd $(dirname $0);cd "../..";pwd);
resDir="$projpath/build/wechatgame/res";

genManifest(){
    cd $resDir;
    local now=`date +%s`;
    zipPath="$projpath/build/fz${now}.zip";
    if [ -e "$zipPath" ]; then
        rm "$zipPath";
    fi
    echo "开始构建zip文件";
    zip -r "$zipPath" .;
    echo "生成${zipPath}完成";
    echo "开始生成manifest.json文件";
    local manifestPath="$resDir/manifest.json";
    echo -e "{ \"files\": [" > $manifestPath;
    find . -type f | awk '{a = "\"" substr($0, 2) "\","; printf a;}' >> $manifestPath;
    sed -i '$ s/,$//' $manifestPath;
    echo -e "]," >> $manifestPath;
    echo -e "\"zipfile\": \"/fz${now}.zip\"}" >> $manifestPath;
    echo "已生成manifest文件";
    cp $manifestPath $resDir;
}

uploadRes(){
    #TODO 上传需要放在远程的资源
}

cleanRes(){
    # 保留manifest文件，清除其他存在会被上传的资源
    cd $resDir;
    rm -rf import
    rm -rf raw-assets
    rm -rf raw-internal
}

run(){
   genManifest;
   uploadRes; 
   cleanRes;
}

run;