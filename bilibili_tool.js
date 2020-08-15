// ==UserScript==
// @name         B站（bilibili）小功能汇总，视频集数进度记录，弹幕快捷键等
// @namespace    http://tampermonkey.net/
// @version      0.6.9
// @icon         https://raw.githubusercontent.com/Anjude/tampermonkey/master/images/bilibili_tool.png
// @description  目前提供记录集数观看进度（看UP上传的网课必备）、弹幕按键开关、搜索页面标记已看视频、完成每日任务（除投币任务）、视频全屏等功能，更多请参考详细描述，有空就会更新~
// @author       anjude
// @match        https://*.bilibili.com/*
// @require      https://cdn.bootcss.com/jquery/3.5.0/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/js-cookie@2/src/js.cookie.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
	'use strict';
	// console.log(window)
	// console.log(window.location.href)
	// console.log(GM_getValue('schedule_chart'))
	/**
	 * 键盘编码：https://blog.csdn.net/zhaozhbcn/article/details/38852583
	 * 对应编码数值填至相应设置中就可以
	 * 例子： var is_barrage = 77 为键盘 M ，把原本66改为77即可
	 */

	var is_barrage = 66 // 键盘B，开关弹幕
	var is_fullscreen = 70 // 键盘F，开关全屏
	var his_chap = 72 // 键盘H，查看历史观看集数
	var jump_chap = 74 // 键盘J，跳转上次观看集数

	var search_page = {
		listener: -1,
		last_bv_id: -1
	}
	var focus = false
	if (/message\.bilibili\.com/.test(document.location.href)) {
		// console.log('page_info:', document.location.href)
		return;
	}
	if (/video\/.v([0-9a-zA-Z]*)\??/i.test(document.location.href)) {
		videoPage();
		new Date().getDate() == GM_getValue('share_date') ? console.log('[B站（bilibili）小功能汇总]: 今日已完成分享') : doShare();
	}
	if (/search.bilibili.com/i.test(document.location.href)) {
		searchPage();
		// video-list clearfix https://search.bilibili.com/all
	}
	if (/space.bilibili.com/i.test(document.location.href)) {
		spacePage();
		// fav-video-list clearfix content https://space.bilibili.com/416030291/favlist
	}
	$(document).ready(() => {
		$("div").delegate("input, textarea",
			"focus",
			function() {
				focus = true
				console.log('onfocus')
			});
		$("div").delegate("input, textarea",
			"blur",
			function() {
				console.log('onblur')
				focus = false
			});
		$(document).keydown((e) => {
			if (focus) {
				return;
			}
			// console.log('键盘：',e)
			switch (e.keyCode) {
				case is_barrage:
					isBarrage();
					break;
				case is_fullscreen:
					isFullscreen();
					break;
				case his_chap:
					hisChap();
					break;
				case jump_chap:
					jumpChap();
					break;
			}
		})
	});
	// 个人空间页面
	function spacePage(){
		
	}
	// 自动完成每日分享，亲测可用
	function doShare() {
		console.log('[B站（bilibili）小功能汇总]: 开始分享')
		var i = 0
		var shareListener = setInterval(() => {
			var node = $('.van-icon-share_news_default')
			if (node.length || i >= 60) {
				node[0].click()
				document.body.lastChild.remove()
				clearInterval(shareListener)
				if (i < 60) {
					GM_setValue('share_date', new Date().getDate())
					console.log('[B站（bilibili）小功能汇总]: 分享完成')
					_toast({
						message: "分享完成",
						time: 2000
					})
				} else {
					console.log('[B站（bilibili）小功能汇总]: 分享失败，换个视频试试呢~')
				}
			}
			i++;
		}, 1000)
	}

	// 搜索页面逻辑
	function searchPage() {
		if (!$('.video-list').length) {
			return;
		}
		var node = $('.video-list')[0].childNodes
		var bili_alist = GM_getValue('bili_alist') || 'no_bv_id'
		var reg = /video\/(.v[0-9|a-z|A-Z]*)\??/i
		if (reg.exec(node[node.length - 1].innerHTML)[1] == search_page.last_bv_id) {
			return 0;
		}
		search_page.last_bv_id = reg.exec(node[node.length - 1].innerHTML)[1]
		// console.log(node, bili_alist)
		for (var i = 0, len = node.length; i < len; i++) {
			var bv_id = reg.exec(node[i].innerHTML)[1]
			var regx = new RegExp(`&${bv_id}`, 'i')
			var add_div = document.createElement("div");
			add_div.className = 'video-view';
			if (regx.test(bili_alist)) {
				add_div.innerHTML = "看过";
				add_div.style.opacity = 1;
				add_div.style.color = 'red';
			} else {
				add_div.innerHTML = "未看";
			}
			node[i].prepend(add_div);
		}
		// console.log($('.bili-search'))
		$('.bili-search')[0].addEventListener('click', listenerPages, false)
		GM_registerMenuCommand("重置视频看过记录", function() {
			// bv_id part title
			bili_alist = ''
			GM_deleteValue('bili_alist')
			alert('成功删除！')
		});
		return 1;
	}
	// 监听函数,监听切换下一页更新数据
	function listenerPages(e) {
		// console.log(e.target, search_page.listener)
		var i = 0;
		search_page.listener = setInterval(() => {
			if (searchPage() || i >= 66) {
				console.log('[B站（bilibili）小功能汇总]: 开始匹配已看')
				clearInterval(search_page.listener)
				i++;
			};
		}, 1000)
	}

	// 视频页面逻辑
	function videoPage() {
		var bv_id = /video\/(.v[0-9|a-z|A-Z]*)\??/i.exec(document.location.href)[1],
			match_reg = new RegExp(`&${bv_id}`, 'i')
		// console.log('[B站（bilibili）小功能汇总]:', bv_id)
		var schedule_chart = GM_getValue('schedule_chart') || []
		// 查询功能入口
		if (!match_reg.test(GM_getValue('bili_alist'))) {
			GM_setValue('bili_alist', (GM_getValue('bili_alist') || '') + '&' + bv_id)
			// console.log('record new bv_id')
		}
		GM_registerMenuCommand("查看当前视频记录", function() {
			hisChap()
		});

		GM_registerMenuCommand("删除所有视频集数记录", function() {
			// bv_id part title
			schedule_chart = []
			GM_deleteValue('schedule_chart')
			alert('成功删除！')
		});
		// <a href="/video/BV1pt41147eM?p=1" class="" title="01"><i class="van-icon-
		// console.log('监测当前集数', $('.on'))
		// console.log('监测当前集数', document.getElementsByClassName('on'))
		// 监听切换集数事件
		if (document.getElementsByClassName('list-box').length) {
			// var listen_chap = document.getElementsByClassName('on')
			var listen_attr = document.getElementsByClassName('list-box')[0]
			listen_attr.addEventListener('click', listener, false)

			XMLHttpRequest.prototype.send = new Proxy(XMLHttpRequest.prototype.send, {
				"apply": (target, thisArg, args) => {
					thisArg.addEventListener(
						"load", event => {
							try {
								if (!/^{.*}$/.test(event.target.responseText)) {
									return;
								}
								const result = JSON.parse(event.target.responseText);
								if (!result.data.accept_description.length) {
									return;
								}
								// console.log("this:", result)
								listener();
							} catch(err){

							}
						})
					return target.apply(thisArg, args);
				}
			})
		}
	}
	// 监听函数,添加观看记录
	function listener(e) {
		// console.log(document.getElementsByClassName('on'))
		var schedule_chart = GM_getValue('schedule_chart') || []
		var info = []
		var node = document.getElementsByClassName('on')
		for (var i = 0, len = node.length; i < len; i++) {
			if (/video\/(.v[0-9|a-z|A-Z]*)\??/i.test(node[i].innerHTML)) {
				var regx = /video\/(.V[0-9a-zA-Z]*)\?p=(\d+).*title="(.*)"><i/i
				info = regx.exec(node[i].innerHTML)
				break;
			}
		}
		// console.log(info)
		var dic = {
			bv_id: info[1],
			part: `P${info[2]}`,
			title: info[3]
		}
		// console.log(schedule_chart)
		if (schedule_chart.length) {
			for (i = 0, len = schedule_chart.length; i < len; i++) {
				// console.log(schedule_chart, schedule_chart[i])
				if (schedule_chart[i].bv_id == info[1]) {
					schedule_chart[i] = dic
					break;
				} else if (i == (len - 1)) {
					schedule_chart.push(dic)
				}
			}
		} else {
			schedule_chart.push(dic)
			alert('首个视频观看集数进度已经记录啦，点开油猴可以查看菜单~')
		}
		// console.log(schedule_chart)
		GM_setValue('schedule_chart', schedule_chart)
	}

	// 键盘菜单
	// 开关弹幕
	function isBarrage() {
		var node = $('.bui-switch-input')
		for (var i = 0, len = node.length; i < len; i++) {
			if ($('.bui-switch-input')[i].offsetParent) {
				$('.bui-switch-input')[i].click();
				_toast({
					message: '切换',
					time: 100
				})
				break;
			}
		}
	}
	// 开关全屏
	function isFullscreen() {
		// console.log(document.getElementsByClassName('video-state-fullscreen-off'))
		if (document.getElementsByClassName('video-state-fullscreen-off').length) {
			document.getElementsByClassName('bilibili-player-iconfont-fullscreen-off')[0].click()
		} else {
			document.getElementsByClassName('bilibili-player-iconfont-fullscreen-on')[0].click()
		}
	}

	function hisChap() {
		var cur_dic = _getChapDic() || {}
		var tip = cur_dic.bv_id ? `您已观看到 ${cur_dic.part}：${cur_dic.title}` : '本片暂无记录~'
		alert(tip)
	}

	function jumpChap() {
		var dic = _getChapDic()
		if(!dic){
			_toast({
				message: '本片暂无记录',
				time: 2000
			})
			return;
		}
		var part = /P(\d+)/.exec(dic.part)[1]
		$('.list-box')[0].children[part - 1].getElementsByTagName('i')[0].click()
		_toast({
			message: "跳转上次播放集数",
			time: 2000
		})
	}

	function _getChapDic() {
		if(!/video\/(.v[0-9|a-z|A-Z]*)\??/i.exec(document.location.href)){
			return 0;
		}
		var cur_dic = {}
		var schedule_chart = GM_getValue('schedule_chart') || []
		var bv_id = /video\/(.v[0-9|a-z|A-Z]*)\??/i.exec(document.location.href)[1]
		// bv_id part title
		// console.log(schedule_chart)
		for (var i = 0, len = schedule_chart.length; i < len; i++) {
			if (!schedule_chart[i].bv_id) {
				continue;
			}
			var regx = new RegExp(schedule_chart[i].bv_id, "i");
			// console.log(regx, regx.test(bv_id))
			if (regx.test(bv_id)) {
				cur_dic = schedule_chart[i]
				break;
			}
		}
		return cur_dic
	}

	function _toast(params = { message: "已完成", time: 2000}) {
		/*设置信息框停留的默认时间*/
		var time = params.time || 2000;
		var el = document.createElement("div");
		el.setAttribute("class", "web-toast");
		el.innerHTML = params.message || "已完成";
		document.body.appendChild(el);
		el.classList.add("fadeIn");
		setTimeout(function() {
			el.classList.remove("fadeIn");
			el.classList.add("fadeOut");
			/*监听动画结束，移除提示信息元素*/
			el.addEventListener("animationend", function() {
				document.body.removeChild(el);
			});
			el.addEventListener("webkitAnimationEnd", function() {
				document.body.removeChild(el);
			});
		}, time);
	}
	GM_addStyle(`
    .video-view{
      display:inline-block;
      position:absolute;
      left:0px;
      top:0px;
      background:#FFF;
      color:#666;
      opacity: 0.8;
      padding:1px 5px;
      z-index:999;
    }
    @keyframes fadeIn {
    0%    {opacity: 0}
	    100%  {opacity: 1}
	}
	@-webkit-keyframes fadeIn {
	    0%    {opacity: 0}
	    100%  {opacity: 1}
	}
	@-moz-keyframes fadeIn {
	    0%    {opacity: 0}
	    100%  {opacity: 1}
	}
	@-o-keyframes fadeIn {
	    0%    {opacity: 0}
	    100%  {opacity: 1}
	}
	@-ms-keyframes fadeIn {
	    0%    {opacity: 0}
	    100%  {opacity: 1}
	}
	@keyframes fadeOut {
	    0%    {opacity: 1}
	    100%  {opacity: 0}
	}
	@-webkit-keyframes fadeOut {
	    0%    {opacity: 1}
	    100%  {opacity: 0}
	}
	@-moz-keyframes fadeOut {
	    0%    {opacity: 1}
	    100%  {opacity: 0}
	}
	@-o-keyframes fadeOut {
	    0%    {opacity: 1}
	    100%  {opacity: 0}
	}
	@-ms-keyframes fadeOut {
	    0%    {opacity: 1}
	    100%  {opacity: 0}
	}
	.web-toast{
	    position: fixed;
	    background: rgba(0, 0, 0, 0.7);
	    color: #fff;
	    font-size: 14px;
	    line-height: 1;
	    padding:10px;
	    border-radius: 3px;
	    left: 50%;
	    top: 50%;
	    transform: translate(-50%,-50%);
	    -webkit-transform: translate(-50%,-50%);
	    -moz-transform: translate(-50%,-50%);
	    -o-transform: translate(-50%,-50%);
	    -ms-transform: translate(-50%,-50%);
	    z-index: 9999;
	    white-space: nowrap;
	}
	.fadeOut{
	    animation: fadeOut .5s;
	}
	.fadeIn{
	    animation:fadeIn .5s;
	}
	`)
})();