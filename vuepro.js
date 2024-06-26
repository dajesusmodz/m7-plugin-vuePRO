/* eslint-disable camelcase */
/* eslint-disable guard-for-in */
/* eslint-disable no-unused-vars */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
/* eslint-disable one-var */
/* eslint-disable no-var */
/*
 *  vuePRO IPTV Player for Movian / M7 Media Center
 *
 *  Copyright (C) 2015-2018 lprot
 *  Copyright (C) 2024-2024 dajesusmodz
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('movian/page');
var service = require('movian/service');
var settings = require('movian/settings');
var http = require('movian/http');
var string = require('native/string');
var popup = require('native/popup');
var io = require('native/io');
var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + plugin.icon;
var DeanEdwardsUnpacker = require('./utils/Dean-Edwards-Unpacker').unpacker;

RichText = function(x) {
  this.str = x.toString();
};

RichText.prototype.toRichString = function(x) {
  return this.str;
};

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36';

function setPageHeader(page, title) {
  if (page.metadata) {
    page.metadata.title = new RichText(decodeURIComponent(title));
    page.metadata.logo = logo;
  }
  page.type = 'directory';
  page.contents = 'items';
  page.loading = false;
  page.model.contents = 'grid';
  page.metadata.background = Plugin.path + "bg.png"
}

var blue = '6699CC',
  orange = 'FFA500',
  red = 'EE0000',
  green = '008B45';

function coloredStr(str, color) {
  return '<font color="' + color + '">' + str + '</font>';
}

function trim(s) {
  if (s) return s.replace(/(\r\n|\n|\r)/gm, '').replace(/(^\s*)|(\s*$)/gi, '').replace(/[ ]{2,}/gi, ' ').replace(/\t/g, '');
  return '';
}

service.create(plugin.title, plugin.id + ':start', 'vuePRO', true, logo);

settings.globalSettings(plugin.id, plugin.title, logo, plugin.synopsis);
settings.createMultiOpt('selectRegion', 'Channel Region (May Be Geo-Restricted)', [
          ['United States', 'United States'],
          ['United Kingdom', 'United Kingdom'],
          ['France', 'France'],
          ['Canada', 'Canada'],
          ['Brazil', 'Brazil'],
          ['South Korea', 'South Korea'],
          ['Mexico', 'Mexico'],
          ['Chile', 'Chile'],
          ['Germany', 'Germany'],
          ['Switzerland', 'Switzerland'],
          ['Denmark', 'Denmark'],
          ['Sweden', 'Sweden'],
          ['Spain', 'Spain'],
          ['Austria', 'Austria'],
          ['Italy', 'Italy'],
          ['India', 'India'],
          ['Norway', 'Norway'],
          ['Off', 'Off', true],
        ], function(v) {
        service.selectRegion = v;
});
settings.createMultiOpt('updatechannel', 'Select Update Channel', [
  ['Stable', 'Stable'],
  ['Pre-Release', 'Pre-Release'],
], function(v) {
service.updatechannel = v;
});
//settings.createBool('disableEPG', 'Don\'t fetch EPG', true, function(v) {
  //service.disableEPG = v;
//});
//settings.createString('acestreamIp', 'IP address of AceStream Proxy. Enter IP only.', '192.168.0.93', function(v) {
  //service.acestreamIp = v;
//});
settings.createBool('disableMyFavorites', 'Hide My Favorites', false, function(v) {
  service.disableMyFavorites = v;
});
settings.createBool('debug', 'Enable Debug Logging', false, function(v) {
  service.debug = v;
});

var store = require('movian/store').create('favorites');
if (!store.list) {
  store.list = '[]';
}

var playlists = require('movian/store').create('playlists');
if (!playlists.list) {
  playlists.list = '[]';
}

function addOptionForAddingToMyFavorites(item, link, title, icon) {
  item.addOptAction('Add \'' + title + '\' to My Favorites', function() {
    var entry = JSON.stringify({
      link: encodeURIComponent(link),
      title: encodeURIComponent(title),
      icon: encodeURIComponent(icon),
    });
    store.list = JSON.stringify([entry].concat(eval(store.list)));
    popup.notify('\'' + title + '\' has been added to My Favorites.', 3);
  });
}

function addOptionForRemovingFromMyFavorites(page, item, title, pos) {
  item.addOptAction('Remove \'' + title + '\' from My Favorites', function() {
    var list = eval(store.list);
    popup.notify('\'' + title + '\' has been removed from My Favorites.', 3);
    list.splice(pos, 1);
    store.list = JSON.stringify(list);
    page.redirect(plugin.id + ':myfavs');
  });
}

var API = 'https://www.googleapis.com/youtube/v3',
  key = 'AIzaSyCSDI9_w8ROa1UoE2CNIUdDQnUhNbp9XR4';

new page.Route(plugin.id + ':youtube:(.*)', function(page, title) {
  page.loading = true;
  try {
    var doc = http.request(API + '/search', {
      args: {
        part: 'snippet',
        type: 'video',
        q: unescape(title),
        maxResults: 1,
        eventType: 'live',
        key: key,
      },
    }).toString();
    page.redirect('youtube:video:' + JSON.parse(doc).items[0].id.videoId);
  } catch (err) {
    page.metadata.title = unescape(title);
    page.error('Sorry, can\'t get the channel\'s link :(');
  }
  page.loading = false;
});

new page.Route(plugin.id + ':tivix:(.*):(.*):(.*)', function(page, url, title, icon) {
  setPageHeader(page, unescape(title));
  page.loading = true;
  var resp = http.request(unescape(url)).toString();
  var re = /Playerjs\([\S\s]+?file[\S\s]+?"([^"]+)/gm; // https://imgur.com/a/rQ0Yaiy
  var pageload = /content=\"http:\/\/tv.tivix.co([\S\s]*?)\" \/>/g;
  var authurl1regex = /\s+var\s+firstIpProtect\s+=\s+\'([\S\s]*?)\'\;/g;
  var authurl2regex = /\s+var\s+secondIpProtect\s+=\s+\'([\S\s]*?)\'\;/g;
  var authurl3regex = /\s+var\s+portProtect\s+=\s+\'([\S\s]*?)\'\;/g;
  var authurl1match = authurl1regex.exec(resp);
  var authurl2match = authurl2regex.exec(resp);
  var authurl3match = authurl3regex.exec(resp);
  var authurl1link = authurl1match[1];
  var authurl2link = authurl2match[1];
  var authurl3link = authurl3match[1];

  var pagematch = pageload.exec(resp);
  var headerreferer = pagematch[1];
  var originreferer = 'http://tv.tivix.co';
  var match = re.exec(resp);


  var authurl = fd2(match[1]);
  var hostref = '';
  if (/{v1}/.test(authurl)) {
    hostref = authurl1link;
  } else {
    hostref = authurl2link;
  }
  var re1 = /{v1}/g;
  var re2 = /{v2}/g;
  var re3 = /{v3}/g;
  var reqstv = '';
  var authurl1 = authurl.replace(re1, authurl1link);
  var authurl2 = authurl1.replace(re2, authurl2link);
  var authurl3 = authurl2.replace(re3, authurl3link);
  if (!match) {
    re = /skin" src="([\S\s]*?)"/g;
    match = re.exec(resp);
    // console.log(match);
  }
  if (!match) {
    re = /<span id="srces" style="display:none">([\S\s]*?)</g;
    match = re.exec(resp);
    // console.log(match);
  }
  while (match) {
    console.log(authurl3);
    console.log(originreferer + headerreferer + ' | ' + hostref + ':8081');
    console.log(match[1]);
    //
    reqstv = http.request(authurl3, {
      // не перенапровлять
      noFollow: true,
      // не выдовать ошибку при 404
      noFail: true,
      // дебаг вывод
      debug: true,
      // пост дата для запроса с
      postdata: {},
      headers: {
        'Origin': originreferer,
        'Referer': originreferer + headerreferer,
        'Host': hostref + ':8081',
        'User-Agent': 'Mozilla/5.0 (X11; HasCodingOs 1.0; Linux x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
      },
    });

    if (reqstv.statuscode == '200') {
      console.log('status 200');
    }
    //
    // io.httpInspectorCreate('.*' + match[1].replace('http://', '').replace('https://', '').split(/[/?#]/)[0].replace(/\./g, '\\.') + '.*', function(req) {
    io.httpInspectorCreate(authurl3, function(req) {
      req.setHeader('Origin', originreferer);
      req.setHeader('Referer', originreferer + headerreferer);
      req.setHeader('Host', hostref + ':8081');
      req.setHeader('User-Agent', 'Mozilla/5.0 (X11; HasCodingOs 1.0; Linux x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36');
    });
    console.log('Probing: ' + match[1]);
    console.log('OUT: ' + io.probe(authurl3).result);
    if (!authurl3.match(/m3u8/) && io.probe(authurl3).result) {
      match = re.exec(resp);
      continue;
    }
    var link = unescape(authurl3);
    // if (link.match(/rtmp/))
    //    link += ' swfUrl=http://tivix.co' + (resp.match(/data="(.*)"/) ? resp.match(/data="(.*)"/)[1] : '') + ' pageUrl=' + unescape(url);
    // log('Playing url: ' + url);
    playUrl(page, link, plugin.id + ':tivix:' + url + ':' + title, unescape(title), 0, icon);
    return;
  }
  console.log('NONE');

  // try to get youtube link
  match = resp.match(/\.com\/v\/([\S\s]*?)(\?|=)/);
  if (match) {
    page.redirect('youtube:video:' + match[1]);
    return;
  }
  if (resp.match('Канал удалён по требованию правообладателя')) {
    page.error('Канал удалён по требованию правообладателя =(');
  } else {
    page.error('Sorry, can\'t get the link :(');
  }
  page.loading = false;
});

new page.Route(plugin.id + ':acestream:(.*):(.*)', function(page, id, title) {
  playUrl(page, 'http://' + service.acestreamIp + ':6878/ace/manifest.m3u8?id=' + id.replace('//', ''), plugin.id + ':acestream:' + id + ':' + title, unescape(title));
});

function playUrl(page, url, canonicalUrl, title, mimetype, icon, subsscan, imdbid) {
  if (url) {
    console.log('playUrl: ' + url + ' | ' + canonicalUrl);
    if (url.substr(0, 2) == '//') {
      url = 'http:' + url;
    }
    page.type = 'video';
    page.source = 'videoparams:' + JSON.stringify({
      title: title,
      imdbid: imdbid ? imdbid : void (0),
      canonicalUrl: canonicalUrl,
      icon: icon ? unescape(icon) : void (0),
      sources: [{
        url: url.match(/m3u8/) ? 'hls:' + url : url,
        mimetype: mimetype ? mimetype : void (0),
      }],
      no_subtitle_scan: subsscan ? false : true,
      no_fs_scan: subsscan ? false : true,
    });
  } else {
    page.error('Sorry, can\'t get the link :(');
  }
  page.loading = false;
}

new page.Route(plugin.id + ':hls:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  playUrl(page, 'http://' + unescape(url), plugin.id + ':hls:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':m3u8:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  var resp = http.request('http://' + unescape(url)).toString();
  var match = resp.match(/[^ "|\'|>]+m3u8[^ "|\'|<]*/g);
  for (var i in match) {
    var elem = match[i].replace(/\\\//g, '/').replace(/^\/\//g, 'http://');
    if (elem.match(/^http/)) {
      match = elem;
      break;
    }
  }

  io.httpInspectorCreate('.*' + match.replace('http://', '').replace('https://', '').split(/[/?#]/)[0].replace(/\./g, '\\.') + '.*', function(req) {
    req.setHeader('Referer', 'http://' + unescape(url));
    req.setHeader('User-Agent', UA);
  });

  playUrl(page, match, plugin.id + ':m3u8:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':gledai:(.*):(.*):(.*)', function(page, channel, route, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  r = 'http://www.bg-gledai.me/new/geto2.php?my=' + unescape(channel);

  var resp = http.request(r, {
    headers: {
      'Host': 'www.bg-gledai.me',
      'Referer': 'http://' + unescape(route),
      'User-Agent': UA,
    },
  }).toString();
  var s = unescape(unescape(resp).match(/unescape\(\'(.*?)\'/)[1]);
  resp = http.request(s, {
    headers: {
      'Host': 'www.bg-gledai.me',
      'Referer': r,
      'User-Agent': UA,
    },
  }).toString();
  match = resp.match(/file>(.*?)</)[1].replace(/&amp;/g, '&');
  io.httpInspectorCreate('.*gledai.*', function(req) {
    req.setHeader('Origin', 'http://bg.gledai.me');
    req.setHeader('Referer', r);
    req.setHeader('User-Agent', UA);
  });
  playUrl(page, match, plugin.id + ':gledai:' + channel + ':' + route + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':ovva:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  var match = http.request('https://' + unescape(url)).toString();
  if (match.match(/data-timer="([\s\S]*?)"/)) {
    page.error('Трансляция будет доступна: ' + new Date(match.match(/data-timer="([\s\S]*?)"/)[1] * 1000));
    return;
  }
  var json = match.match(/ovva-player","([\s\S]*?)"/);
  if (json) {
    json = JSON.parse(Duktape.dec('base64', json[1]));
  }
  match = 0;
  if (json) {
    json = http.request(json.balancer).toString();
    log(json);
    match = json.match(/=([\s\S]*?$)/);
    if (match) match = match[1];
  }
  playUrl(page, match, plugin.id + ':ovva:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':dailymotion:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  var resp = http.request('http://www.dailymotion.com/embed/video/' + url).toString();
  var match = resp.match(/stream_chromecast_url":"([\S\s]*?)"/);
  if (match) match = match[1].replace(/\\\//g, '/');
  playUrl(page, match, plugin.id + ':dailymotion:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':euronews:(.*):(.*)', function(page, country, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  if (country == 'en') {
    country = 'www';
  }
  var json = JSON.parse(http.request('http://' + country + '.euronews.com/api/watchlive.json'));
  json = JSON.parse(http.request(json.url));
  playUrl(page, json.primary, plugin.id + ':euronews:' + country + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':ts:(.*):(.*)', function(page, url, title) {
  page.metadata.title = unescape(title);
  page.loading = true;
  playUrl(page, unescape(url), plugin.id + ':ts:' + url + ':' + title, unescape(title), 'video/mp2t');
});

// Favorites
new page.Route(plugin.id + ':favorites', function(page) {
  setPageHeader(page, 'My Favorites');
  fill_fav(page);
});

new page.Route(plugin.id + ':indexTivix:(.*):(.*)', function(page, url, title) {
  page.model.contents = 'grid';
  setPageHeader(page, decodeURIComponent(title));
  var url = prefixUrl = 'http://tv.tivix.co' + decodeURIComponent(url);
  var tryToSearch = true,
    fromPage = 1,
    n = 0;

  function loader() {
    if (!tryToSearch) return false;
    page.loading = true;
    var doc = http.request(url).toString();
    page.loading = false;
    // 1-title, 2-url, 3-icon
    var re = /<div class="all_tv" title="([\S\s]*?)">[\S\s]*?href="([\S\s]*?)"[\S\s]*?<img src="([\S\s]*?)"/g;
    var match = re.exec(doc);
    while (match) {
      var icon = 'http://tv.tivix.co' + match[3];
      var link = plugin.id + ':tivix:' + escape(match[2]) + ':' + escape(match[1]) + ':' + escape(icon);
      var item = page.appendItem(link, 'video', {
        title: match[1],
        icon: icon,
      });
      addOptionForAddingToMyFavorites(item, link, match[1], icon);
      n++;
      match = re.exec(doc);
    }
    page.metadata.title = new RichText(decodeURIComponent(title) + ' (' + n + ')');
    var next = doc.match(/">Вперед<\/a>/);
    if (!next) {
      return tryToSearch = false;
    }
    fromPage++;
    url = prefixUrl + 'page/' + fromPage;
    return true;
  }
  loader();
  page.paginator = loader;
  page.loading = false;
});

new page.Route(plugin.id + ':tivixStart', function(page) {
  page.model.contents = 'grid';
  setPageHeader(page, 'tv.tivix.co');
  page.loading = true;
  var doc = http.request('http://tv.tivix.co').toString();
  page.loading = false;
  var re = /<div class="menuuuuuu"([\S\s]*?)<\/div>/g;
  var menus = re.exec(doc);
  var re2 = /<a href="([\S\s]*?)"[\S\s]*?>([\S\s]*?)<\/a>/g;
  while (menus) {
    var submenus = re2.exec(menus[1]);
    while (submenus) {
      page.appendItem(plugin.id + ':indexTivix:' + encodeURIComponent(submenus[1]) + ':' + encodeURIComponent(submenus[2]), 'directory', {
        title: submenus[2],
      });
      submenus = re2.exec(menus[1]);
    }
    menus = re.exec(doc);
  }
  var packed = http.request('http://tv.tivix.co/templates/Default/js/tv-pjs.js?v=2', {
    headers: {
      'Referer': 'http://tv.tivix.co',
      'User-Agent': UA,
    }}).toString();
  var unpacked = DeanEdwardsUnpacker.unpack(packed);
  u = unpacked.match(/u:'([^']+)/)[1];
  v = JSON.parse(decode(u));
  v.file3_separator = '//';

  o = {
    y: 'xx???x=xx??x?=',
  };
});

var devId = 0;
if (!devId) {
  devId = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(t) {
    var e = 16 * Math.random() | 0,
      n = 'x' == t ? e : 3 & e | 8;
    return n.toString(16);
  });
}

new page.Route(plugin.id + ':playYoutv:(.*):(.*):(.*)', function(page, url, title, icon) {
  page.loading = true;
  var json = JSON.parse(http.request(unescape(url), {
    headers: {
      'Device-Uuid': devId,
      'Host': 'api.youtv.com.ua',
      'Origin': 'https://youtv.com.ua',
      'Referer': 'https://youtv.com.ua/',
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
    },
    debug: service.debug,
  }));

  var link = 'https:' + json.playback_url;

  io.httpInspectorCreate('.*' + link.replace('http://', '').replace('https://', '').split(/[/?#]/)[0].replace(/\./g, '\\.') + '.*', function(req) {
    req.setHeader('Referer', 'https://youtv.com.ua/');
    req.setHeader('X-Requested-With', 'ShockwaveFlash/28.0.0.126');
    req.setHeader('User-Agent', UA);
  });
  playUrl(page, link, plugin.id + ':playYoutv:' + url + ':' + title, unescape(title), 0, icon);
});

new page.Route(plugin.id + ':youtvStart', function(page) {
  page.model.contents = 'grid';
  setPageHeader(page, 'Youtv.com.ua');
  page.loading = true;
  var doc = http.request('https://youtv.com.ua/api/start', {
    headers: {
      'Accept': 'application/vnd.youtv.v3+json',
      'Device-Uuid': devId,
      'Host': 'youtv.com.ua',
      'Referer': 'https://youtv.com.ua/',
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
    },
    debug: service.debug,
  }).toString();
  log(doc);

  var json = JSON.parse(http.request('https://youtv.com.ua/api/playlist', {
    headers: {
      'Accept': 'application/vnd.youtv.v3+json',
      'Device-Uuid': devId,
      'Host': 'youtv.com.ua',
      'Origin': 'https://youtv.com.ua',
      'Referer': 'https://youtv.com.ua/',
      'User-Agent': UA,
      'X-Requested-With': 'XMLHttpRequest',
    },
    postdata: {},
    debug: service.debug,
  }));

  for (var i in json.data) {
    var genres = '',
      first = 1;
    for (var j in json.data[i].categories) {
      if (first) {
        genres += json.data[i].categories[j].name;
        first--;
      } else {
        genres += ', ' + json.data[i].categories[j].name;
      }
    }
    page.appendItem(plugin.id + ':playYoutv:' + escape(json.data[i].sources[0].stream.url) + ':' + escape(json.data[i].name) + ':' + escape(json.data[i].image), 'video', {
      title: new RichText(json.data[i].name),
      genre: genres,
      icon: json.data[i].image,
    });
    page.entries++;
  }
  page.metadata.title += ' (' + page.entries + ')';
  page.loading = false;
});

function addOptionToRemovePlaylist(page, item, title, pos) {
  item.addOptAction('Remove \'' + title + '\' playlist from the list', function() {
    var playlist = eval(playlists.list);
    popup.notify('\'' + title + '\' has been removed from the list.', 3);
    playlist.splice(pos, 1);
    playlists.list = JSON.stringify(playlist);
    page.flush();
    page.redirect(plugin.id + ':start');
  });
}

function showPlaylist(page) {
  var playlist = eval(playlists.list);

  popup.notify('Check for Updates in the Side-Menu', 7);

  var pos = 0;
  for (var i in playlist) {
    var itemmd = JSON.parse(playlist[i]);
    if (!itemmd.link.match(/m3u:http/) && !itemmd.link.match(/xml:http/)) {
      itemmd.link = 'm3u:' + itemmd.link;
    }
    var item = page.appendItem(itemmd.link + ':' + itemmd.title, 'directory', {
      title: decodeURIComponent(itemmd.title),
      link: decodeURIComponent(itemmd.link),
    });
    addOptionToRemovePlaylist(page, item, decodeURIComponent(itemmd.title), pos);
    pos++;
  }
}

var m3uItems = [],
  groups = [],
  theLastList = '';

new page.Route('m3uGroup:(.*):(.*)', function(page, pl, groupID) {
  setPageHeader(page, decodeURIComponent(groupID));
  if (theLastList != pl) {
    readAndParseM3U(page, pl);
  }

  var num = 0;
  for (var i in m3uItems) {
    if (decodeURIComponent(groupID) != m3uItems[i].group) {
      continue;
    }
    addItem(page, m3uItems[i].url, m3uItems[i].title, m3uItems[i].logo, '', '', '', m3uItems[i].headers);
    num++;
  }
  page.metadata.title = decodeURIComponent(groupID) + ' (' + num + ')';
  page.loading = false;
  popup.notify("Right Click / Hold an Item to View it's Options.", 4);
});

function readAndParseM3U(page, pl, m3u) {
  var title = page.metadata.title + '';
  page.loading = true;
  if (!m3u) {
    page.metadata.title = 'Downloading M3U list...';
    log('Fetching: ' + decodeURIComponent(pl));
    m3u = http.request(decodeURIComponent(pl), {
      headers: {
        'User-Agent': UA,
      },
    }).toString().split('\n');
  };
  theLastList = pl;
  m3uItems = [], groups = [];
  var m3uUrl = '',
    m3uTitle = '',
    m3uImage = '',
    m3uGroup = '';
  var line = '',
    m3uRegion = '',
    m3uEpgId = '',
    m3uHeaders = '';
  m3uUA = '';

  for (var i = 0; i < m3u.length; i++) {
    page.metadata.title = 'Parsing M3U list. Line ' + i + ' of ' + m3u.length;
    line = m3u[i].trim();
    if (line.substr(0, 7) != '#EXTM3U' && line.indexOf(':') < 0 && line.length != 40) continue; // skip invalid lines
    line = string.entityDecode(line.replace(/[\u200B-\u200F\u202A-\u202E]/g, ''));
    switch (line.substr(0, 7)) {
      case '#EXTM3U':
        var match = line.match(/region=(.*)\b/);
        if (match) {
          m3uRegion = match[1];
        }
        break;
      case '#EXTINF':
        var match = line.match(/#EXTINF:.*,(.*)/);
        if (match) {
          m3uTitle = match[1].trim();
        }
        match = line.match(/group-title="([\s\S]*?)"/);
        if (match) {
          m3uGroup = match[1].trim();
          if (groups.indexOf(m3uGroup) < 0) {
            groups.push(m3uGroup);
          }
        }
        match = line.match(/tvg-logo=["|”]([\s\S]*?)["|”]/);
        if (match) {
          m3uImage = match[1].trim();
        }
        match = line.match(/region="([\s\S]*?)"/);
        if (match) {
          m3uRegion = match[1];
        }
        if (m3uRegion) {
          match = line.match(/description="([\s\S]*?)"/);
          if (match) {
            m3uEpgId = match[1];
          }
        }
        break;
      case '#EXTGRP':
        var match = line.match(/#EXTGRP:(.*)/);
        if (match) {
          m3uGroup = match[1].trim();
          if (groups.indexOf(m3uGroup) < 0) {
            groups.push(m3uGroup);
          }
        }
        break;
      case '#EXTVLC':
        var match = line.match(/http-(user-agent=[\s\S]*)$/);
        if (match) {
          m3uUA = match[1];
        }
        break;
      default:
        if (line[0] == '#') {
          m3uImage = '';
          continue; // skip unknown tags and comments
        }
        line = line.replace(/rtmp:\/\/\$OPT:rtmp-raw=/, '');
        if (line.indexOf(':') == -1 && line.length == 40) {
          line = 'acestream://' + line;
        }
        if (m3uImage && m3uImage.substr(0, 4) != 'http') {
          m3uImage = line.match(/^.+?[^\/:](?=[?\/]|$)/) + '/' + m3uImage;
        }
        m3uHeaders = line.match(/([\s\S]*?)\|([\s\S]*?)$/);
        m3uHeaders ? line = m3uHeaders[1] : '';
        m3uItems.push({
          title: m3uTitle ? m3uTitle : line,
          url: line,
          group: m3uGroup,
          logo: m3uImage,
          region: m3uRegion,
          epgid: m3uEpgId,
          // headers: m3uHeaders ? m3uHeaders[2] : void (0),
          headers: m3uHeaders ? m3uHeaders[2] : m3uUA ? m3uUA : void (0),
        });
        m3uUrl = '', m3uTitle = '', m3uImage = '', m3uEpgId = '', m3uHeaders = ''; // , m3uGroup = '';
    }
  }
  page.metadata.title = title;
}

function addItem(page, url, title, icon, description, genre, epgForTitle, headers) {
  if (!epgForTitle) epgForTitle = '';
  var type = 'video';
  var link = url.match(/([\s\S]*?):(.*)/);
  var linkUrl = 0;
  var playlistType = isPlaylist(url);
  if (link && playlistType) {
    link = linkUrl = playlistType + ':' + encodeURIComponent(url) + ':' + escape(title);
    type = 'directory';
  } else
  if (link && !link[1].toUpperCase().match(/HTTP/) && !link[1].toUpperCase().match(/RTMP/)) {
    link = linkUrl = plugin.id + ':' + url + ':' + escape(title);
  } else {
    linkUrl = url.toUpperCase().match(/M3U8/) || url.toUpperCase().match(/\.SMIL/) ? 'hls:' + url : url;
    link = 'videoparams:' + JSON.stringify({
      title: title,
      icon: icon ? icon : void (0),
      sources: [{
        url: linkUrl,
      }],
      no_fs_scan: true,
      no_subtitle_scan: true,
    });
  }

  // get icon from description
  if (!icon && description) {
    icon = description.match(/img src="([\s\S]*?)"/);
    if (icon) icon = icon[1];
  }
  if (!linkUrl) {
    var item = page.appendPassiveItem(type, '', {
      title: new RichText(title + epgForTitle),
      icon: icon ? icon : null,
      genre: genre,
      description: new RichText(description),
    });
  } else {
    if (headers) {
      io.httpInspectorCreate('.*' + url.replace('http://', '').replace('https://', '').split(/[/?#]/)[0].replace(/\./g, '\\.') + '.*', function(req) {
        var tmp = headers.split('|');
        for (i in tmp) {
          var header = unescape(tmp[i].replace(/\"/g, '')).match(/([\s\S]*?)=([\s\S]*?)$/);
          if (header) {
            req.setHeader(header[1], header[2]);
          }
        }
      });
    }
    var item = page.appendItem(link, type, {
      title: new RichText(title + epgForTitle),
      icon: icon ? icon : null,
      genre: genre,
      description: new RichText((linkUrl ? coloredStr('Link: ', orange) + linkUrl : '') +
        (description ? '\n' + description : '')),
    });
    addOptionForAddingToMyFavorites(item, link, title, icon);
  }
}

function isPlaylist(pl) {
  pl = unescape(pl).toUpperCase();
  var extension = pl.split('.').pop();
  var lastPart = pl.split('/').pop();
  if (pl.substr(0, 4) == 'XML:') {
    return 'xml';
  }
  if (pl.substr(0, 4) == 'M3U:' || (extension == 'M3U' && pl.substr(0, 4) != 'HLS:') || lastPart == 'PLAYLIST' ||
    pl.match(/TYPE=M3U/) || pl.match(/BIT.DO/) || pl.match(/BIT.LY/) || pl.match(/GOO.GL/) ||
    pl.match(/TINYURL.COM/) || pl.match(/RAW.GITHUB/)) {
    return 'm3u';
  }
  return false;
}

function showM3U(page, pl) {
  var num = 0;
  for (var i in groups) {
    if (groups[i]) {
      page.appendItem('m3uGroup:' + pl + ':' + encodeURIComponent(groups[i]), 'directory', {
        title: groups[i],
      });
    }
    num++;
  }

  for (var i in m3uItems) {
    if (m3uItems[i].group) {
      continue;
    }
    var extension = m3uItems[i].url.split('.').pop().toUpperCase();
    if (isPlaylist(m3uItems[i].url) || (m3uItems[i].url == m3uItems[i].title)) {
      var route = 'm3u:';
      if (m3uItems[i].url.substr(0, 4) == 'xml:') {
        m3uItems[i].url = m3uItems[i].url.replace('xml:', '');
        route = 'xml:';
      }
      if (m3uItems[i].url.substr(0, 4) == 'm3u:') {
        m3uItems[i].url = m3uItems[i].url.replace('m3u:', '');
      }
      page.appendItem(route + encodeURIComponent(m3uItems[i].url) + ':' + encodeURIComponent(m3uItems[i].title), 'directory', {
        title: m3uItems[i].title,
      });
      num++;
    } else {
      var description = '';
      if (m3uItems[i].region && m3uItems[i].epgid) {
        description = getEpg(m3uItems[i].region, m3uItems[i].epgid);
      }
      addItem(page, m3uItems[i].url, m3uItems[i].title, m3uItems[i].logo, description, '', epgForTitle, m3uItems[i].headers);
      epgForTitle = '';
      num++;
    }
    page.metadata.title = 'Adding item ' + num + ' of ' + m3uItems.length;
  }
  return num;
}

new page.Route('m3u:(.*):(.*)', function(page, pl, title) {
  setPageHeader(page, unescape(title));
  page.loading = true;
  readAndParseM3U(page, pl);
  page.metadata.title = new RichText(decodeURIComponent(title) + ' (' + showM3U(page, pl) + ')');
  page.loading = false;
  popup.notify("Right Click / Hold an Item to View it's Options.", 4);
});

var XML = require('movian/xml');

function setColors(s) {
  if (!s) return '';
  return s.toString().replace(/="##/g, '="#').replace(/="lime"/g,
      '="#32CD32"').replace(/="aqua"/g, '="#00FFFF"').replace(/='green'/g,
      '="#00FF00"').replace(/='cyan'/g, '="#00FFFF"').replace(/="LightSalmon"/g,
      '="#ffa07a"').replace(/="PaleGoldenrod"/g, '="#eee8aa"').replace(/="Aquamarine"/g,
      '="#7fffd4"').replace(/="LightSkyBlue"/g, '="#87cefa"').replace(/="palegreen"/g,
      '="#98fb98"').replace(/="yellow"/g, '="#FFFF00"').replace(/font color=""/g, 'font color="#FFFFFF"');
}

new page.Route(plugin.id + ':parse:(.*):(.*)', function(page, parser, title) {
  setPageHeader(page, unescape(title));
  page.loading = true;
  var n = 1;
  log('Parser is: ' + unescape(parser));
  var params = unescape(parser).split('|');
  log('Requesting: ' + params[0]);
  if (!params[0]) {
    page.error('The link is empty');
    return;
  }
  var html = http.request(params[0]).toString();
  var base_url = params[0].match(/^.+?[^\/:](?=[?\/]|$)/);
  if (params.length > 1) {
    var start = html.indexOf(params[1]) + params[1].length;
    var length = html.indexOf(params[2], start) - start;
    var url = html.substr(start, length).split(',');
    log('Found URL: ' + url);
    // var urlCheck = params[1].replace(/\\\//g, '/') + url + params[2].replace(/\\\//g, '/');
    // if (urlCheck.match(/(http.*)/))
    //    url = urlCheck.match(/(http.*)/)[1];
    if (!url[0].trim()) {
      url = html.match(/pl:"([\s\S]*?)"/)[1];
      log('Fetching URL from pl: ' + url);
      var json = JSON.parse(http.request(url));
    } else if (url[0].trim().substr(0, 4) != 'http') {
      if (url[0][0] == '/') {
        page.appendItem(base_url + url[0], 'video', {
          title: new RichText(unescape(title)),
        });
      } else {
        url = url[0].match(/value="([\s\S]*?)"/);
        if (url) {
          url = url[1];
          log('Fetching URL from value: ' + url);
          var json = JSON.parse(http.request(url));
          log(JSON.stringify(json));
          for (var i in json.playlist) {
            if (json.playlist[i].file) {
              page.appendItem(json.playlist[i].file.split(' ')[0], 'video', {
                title: new RichText(json.playlist[i].comment),
              });
            }
            for (var j in json.playlist[i].playlist) {
              // log(json.playlist[i].playlist[j].comment);
              page.appendItem(json.playlist[i].playlist[j].file.split(' ')[0], 'video', {
                title: new RichText(json.playlist[i].comment + ' - ' + json.playlist[i].playlist[j].comment),
              });
            }
          }
        } else {
          log('Fetching URL from file":": ' + url);
          var file = html.match(/file":"([\s\S]*?)"/);
          if (file) {
            page.appendItem(file[1].replace(/\\\//g, '/'), 'video', {
              title: new RichText(unescape(title)),
            });
          } else {
            log('Fetching URL from pl":": ' + url);
            var pl = html.match(/pl":"([\s\S]*?)"/)[1].replace(/\\\//g, '/');
            var json = JSON.parse(http.request(pl).toString().trim());
            for (var i in json.playlist) {
              if (json.playlist[i].file) {
                page.appendItem(json.playlist[i].file.split(' ')[0], 'video', {
                  title: new RichText(json.playlist[i].comment),
                });
              }
              for (var j in json.playlist[i].playlist) {
                // log(json.playlist[i].playlist[j].comment);
                page.appendItem(json.playlist[i].playlist[j].file.split(' ')[0], 'video', {
                  title: new RichText(json.playlist[i].comment + ' - ' + json.playlist[i].playlist[j].comment),
                });
              }
            }
          }
        }
      }
    } else {
      for (i in url) {
        page.appendItem(url[i], 'video', {
          title: new RichText(unescape(title) + ' #' + n),
        });
        n++;
      }
    }
  } else {
    html = html.split('\n');
    for (var i = 0; i < html.length; i++) {
      if (!html[i].trim()) continue;
      page.appendItem(html[i].trim(), 'video', {
        title: new RichText(unescape(title) + ' #' + n),
      });
      n++;
    }
  }
  page.loading = false;
});

var epgForTitle = '';

function getEpg(region, channelId) {
  var description = '';
  if (service.disableEPG) return description;
  try {
    var epg = http.request('https://tv.yandex.ua/' + region + '/channels/' + channelId);
    // 1-time, 2-title
    var re = /tv-event_wanna-see_check i-bem[\s\S]*?<span class="tv-event__time">([\s\S]*?)<\/span><div class="tv-event__title"><div class="tv-event__title-inner">([\s\S]*?)<\/div>/g;
    var match = re.exec(epg);
    var first = true;
    while (match) {
      if (first) {
        epgForTitle = coloredStr(' (' + match[1] + ') ' + match[2], orange);
        first = false;
      }
      description += '<br>' + match[1] + coloredStr(' - ' + match[2], orange);
      match = re.exec(epg);
    }
  } catch (err) { }
  return description;
}

new page.Route('xml:(.*):(.*)', function(page, pl, pageTitle) {
  log('Main list: ' + decodeURIComponent(pl).trim());
  setPageHeader(page, unescape(pageTitle));
  page.loading = true;
  try {
    var doc = XML.parse(http.request(decodeURIComponent(pl)));
  } catch (err) {
    page.error(err);
    return;
  }
  if (!doc.items) {
    page.error('Cannot get proper xml file');
    return;
  }

  var categories = [];
  var category = doc.items.filterNodes('category');
  for (var i = 0; i < category.length; i++) {
    categories[category[i].category_id] = category[i].category_title;
  }

  var channels = doc.items.filterNodes('channel');
  var num = 0;
  for (var i = 0; i < channels.length; i++) {
    var title = string.entityDecode(channels[i].title);
    title = setColors(title);
    var playlist = channels[i].playlist_url;
    var description = channels[i].description ? channels[i].description : null;
    description = setColors(description);

    var icon = null;
    if (channels[i].logo_30x30 && channels[i].logo_30x30.substr(0, 4) == 'http') {
      icon = channels[i].logo_30x30;
    }
    if (!icon && channels[i].logo && channels[i].logo.substr(0, 4) == 'http') {
      icon = channels[i].logo;
    }
    if (!icon && description) {
      icon = description.match(/src="([\s\S]*?)"/);
      if (icon) icon = string.entityDecode(icon[1]);
    }

    // show epg if available
    epgForTitle = '';
    if (channels[i].region && +channels[i].description) {
      description = getEpg(channels[i].region, channels[i].description);
    }
    description = description.replace(/<img[\s\S]*?src=[\s\S]*?(>|$)/, '').replace(/\t/g, '').replace(/\n/g, '').trim();

    genre = channels[i].category_id ? categories[channels[i].category_id] : null;
    if (playlist && playlist != 'null' && !channels[i].parser) {
      var extension = playlist.split('.').pop().toLowerCase();
      if (playlist.match(/m3u8/)) extension = 'm3u';
      if (extension != 'm3u') {
        extension = 'xml';
      }
      var url = extension + ':' + encodeURIComponent(playlist) + ':' + escape(title);
      page.appendItem(url, 'video', {
        title: new RichText(title + epgForTitle),
        icon: icon,
        genre: genre,
        description: new RichText((playlist ? coloredStr('Link: ', orange) + playlist + '\n' : '') + description),
      });
    } else {
      if (channels[i].parser) {
        page.appendItem(plugin.id + ':parse:' + escape(channels[i].parser) + ':' + escape(title), 'directory', {
          title: new RichText(title + epgForTitle),
          genre: genre,
        });
      } else {
        var url = channels[i].stream_url ? channels[i].stream_url : '';
        var match = url.match(/http:\/\/www.youtube.com\/watch\?v=(.*)/);
        if (match) {
          url = 'youtube:video:' + match[1];
          page.appendItem(url, 'video', {
            title: title + epgForTitle,
            icon: icon,
            genre: genre,
            description: new RichText(coloredStr('Link: ', orange) + url),
          });
        } else {
          addItem(page, url, title, icon, description, genre, epgForTitle);
        }
      }
    }
    num++;
  }
  page.metadata.title = new RichText(unescape(pageTitle) + ' (' + num + ')');
  page.loading = false;
});

function log(str) {
  if (service.debug) {
    console.log(str);
    print(str);
  }
}

// Search IMDB ID by title
function getIMDBid(title) {
  var imdbid = null;
  var title = string.entityDecode(unescape(title)).toString();
  log('Splitting the title for IMDB ID request: ' + title);
  var splittedTitle = title.split('|');
  if (splittedTitle.length == 1) {
    splittedTitle = title.split('/');
  }
  if (splittedTitle.length == 1) {
    splittedTitle = title.split('-');
  }
  log('Splitted title is: ' + splittedTitle);
  if (splittedTitle[1]) { // first we look by original title
    var cleanTitle = splittedTitle[1]; // .trim();
    var match = cleanTitle.match(/[^\(|\[|\.]*/);
    if (match) {
      cleanTitle = match;
    }
    log('Trying to get IMDB ID for: ' + cleanTitle);
    resp = http.request('http://www.imdb.com/find?ref_=nv_sr_fn&q=' + encodeURIComponent(cleanTitle)).toString();
    imdbid = resp.match(/class="findResult[\s\S]*?<a href="\/title\/(tt\d+)\//);
    if (!imdbid && cleanTitle.indexOf('/') != -1) {
      splittedTitle2 = cleanTitle.split('/');
      for (var i in splittedTitle2) {
        log('Trying to get IMDB ID (1st attempt) for: ' + splittedTitle2[i].trim());
        resp = http.request('http://www.imdb.com/find?ref_=nv_sr_fn&q=' + encodeURIComponent(splittedTitle2[i].trim())).toString();
        imdbid = resp.match(/class="findResult[\s\S]*?<a href="\/title\/(tt\d+)\//);
        if (imdbid) break;
      }
    }
  }
  if (!imdbid) {
    for (var i in splittedTitle) {
      if (i == 1) continue; // we already checked that
      var cleanTitle = splittedTitle[i].trim();
      var match = cleanTitle.match(/[^\(|\[|\.]*/);
      if (match) {
        cleanTitle = match;
      }
      log('Trying to get IMDB ID (2nd attempt) for: ' + cleanTitle);
      resp = http.request('http://www.imdb.com/find?ref_=nv_sr_fn&q=' + encodeURIComponent(cleanTitle)).toString();
      imdbid = resp.match(/class="findResult[\s\S]*?<a href="\/title\/(tt\d+)\//);
      if (imdbid) break;
    }
  }

  if (imdbid) {
    log('Got following IMDB ID: ' + imdbid[1]);
    return imdbid[1];
  }
  log('Cannot get IMDB ID :(');
  return imdbid;
};

new page.Route(plugin.id + ':streamlive:(.*):(.*):(.*)', function(page, url, title, icon) {
  page.loading = true;
  var doc = http.request(unescape(url)).toString();
  var imdbid = lnk = scansubs = 0;
  var mimetype = 'video/quicktime';
  var direct = doc.match(/"false" type="text\/javascript">([\s\S]*?)<\/script>/);
  if (direct) {
    lnk = eval(direct[1]);
  } else {
    mimetype = 'application/vnd.apple.mpegurl';
    scansubs = true;
    var re = /return\(([\s\S]*?)innerHTML\)/g;
    var match = re.exec(doc);
    while (match) {
      // 1-lnk, 2-array id, 3-inner id
      var tmp = match[1].match(/return\(\[([\s\S]*?)\][\s\S]*?\+ ([\s\S]*?)\.[\s\S]*?getElementById\("([\s\S]*?)"\)\./);
      if (tmp) {
        lnk = 'https:' + tmp[1].replace(/[",\s]/g, '').replace(/\\\//g, '/');
        var re2 = new RegExp(tmp[2] + ' = ([\\s\\S]*?);');
        var tmp2 = re2.exec(doc);
        lnk += tmp2[1].replace(/[\[\]",\s]/g, '');
        re2 = new RegExp(tmp[3] + '>([\\s\\S]*?)<\/span>');
        tmp2 = re2.exec(doc);
        lnk += tmp2[1];
        log(lnk);
      }
      match = re.exec(doc);
    }
  }
  playUrl(page, lnk, plugin.id + ':streamlive:' + url + ':' + title, unescape(title), mimetype, icon, !scansubs, imdbid);
});

new page.Route(plugin.id + ':streamliveStart', function(page) {
  setPageHeader(page, 'StreamLive.to');
  page.loading = true;

  io.httpInspectorCreate('.*streamlive\\.to.*', function(req) {
    req.setHeader('Host', req.url.replace('http://', '').replace('https://', '').split(/[/?#]/)[0]);
    req.setHeader('Origin', 'https://www.streamlive.to');
    req.setHeader('Referer', 'https://www.streamlive.to/channels?list=free');
    // req.setHeader('X-Requested-With', 'XMLHttpRequest');
    req.setHeader('User-Agent', UA);
  });

  var fromPage = 1,
    tryToSearch = true;
  page.entries = 0;

  function loader() {
    if (!tryToSearch) return false;
    page.loading = true;
    var doc = http.request('https://www.streamlive.to/channelsPages.php', {
      postdata: {
        page: fromPage,
        category: '',
        language: '',
        sortBy: 1,
        query: '',
        list: 'free',
      },
    }).toString();
    page.loading = false;

    // 1-icon, 2-title, 3-what's on, 4-viewers, 5-totalviews, 6-genre, 7-language, 8-link
    // 1-link, 2-title, 3-icon, 4-language, 5-description, 6-viewers, 7-totalviews, 8-genre
    var re = /class="ml-item"[\s\S]*?href="([\s\S]*?)"[\s\S]*?title="([\s\S]*?)">[\s\S]*?src="([\s\S]*?)"[\s\S]*?class="jt-info">Language: ([\s\S]*?)<\/div>[\s\S]*?class="f-desc">([\s\S]*?)<\/p>[\s\S]*?<a href="#">([\s\S]*?)<\/a>[\s\S]*?<a href="#">([\s\S]*?)<\/a>[\s\S]*?<a href="#">([\s\S]*?)<\/a>/g;
    match = re.exec(doc);
    var added = 0;
    while (match) {
      page.appendItem(plugin.id + ':streamlive:' + escape(match[1]) + ':' + escape(trim(match[2])) + ':' + escape('https:' + match[3]), 'video', {
        title: trim(match[2]),
        icon: 'https:' + match[3],
        genre: new RichText(trim(match[8]) + coloredStr('<br>Language: ', orange) + trim(match[4])),
        tagline: new RichText((trim(match[5]) ? coloredStr('Now: ', orange) + trim(match[5].replace(/&nbsp;/g, '')).replace(/^"|"$/g, '') : '')),
        description: new RichText(
            coloredStr('Viewers: ', orange) + trim(match[6]) +
          coloredStr(' Total views: ', orange) + trim(match[7])),
      });
      match = re.exec(doc);
      page.entries++;
      added++;
    };
    page.metadata.title = 'StreamLive.to (' + page.entries + ')';
    if (!added) return tryToSearch = false;
    fromPage++;
    return true;
  }
  loader();
  page.paginator = loader;
  page.loading = false;
});

function addActionToTheItem(page, menuText, id, type) {
  page.options.createAction('addPlaylist' + type, menuText, function() {
    var result = popup.textDialog('Enter the URL to the playlist like:\n' +
      'http://bit.ly/' + id + ' or just bit.ly/' + id + ' or ' + id, true, true);
    if (!result.rejected && result.input) {
      var link = result.input;
      if (!link.match(/\./)) {
        link = 'http://bit.ly/' + link;
      }
      if (!link.match(/:\/\//)) {
        link = 'http://' + link;
      }
      var result = popup.textDialog('Enter the name of the playlist:', true, true);
      if (!result.rejected && result.input) {
        var entry = JSON.stringify({
          title: encodeURIComponent(result.input),
          link: type.toLowerCase() + ':' + encodeURIComponent(link),
        });
        playlists.list = JSON.stringify([entry].concat(eval(playlists.list)));
        popup.notify('Playlist \'' + result.input + '\' has been added to the list.', 3);
        page.flush();
        page.redirect(plugin.id + ':start');
      }
    }
  });
}

var idcJson;

new page.Route(plugin.id + ':idcPlay:(.*):(.*)', function(page, id, title) {
  page.loading = true;
  var json = JSON.parse(http.request('http://iptvn.idc.md/api/json/get_url?cid=' + id));
  playUrl(page, unescape(json.url).replace('http/ts', 'http'), plugin.id + ':idcPlay:' + id + ':' + title, decodeURI(title), 'video/mp2t');
});


function getEpgPeriod(ts1, ts2, epg) {
  if (!ts1 || !ts2 || !epg) return '';

  function tsToTime(ts) {
    var a = new Date(ts * 1000);
    return (a.getHours() < 10 ? '0' + a.getHours() : a.getHours()) + ':' + (a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes());
  }
  return ' (' + tsToTime(ts1) + '-' + tsToTime(ts2) + ') ' + epg;
}

new page.Route(plugin.id + ':idcGroups:(.*)', function(page, id) {
  page.loading = true;
  var counter = 0;
  if (!idcJson) getIdc(page, 'https://iptvn.idc.md/api/json/channel_list');
  for (var i in idcJson.groups) {
    if (idcJson.groups[i].id != id) {
      continue;
    }
    if (counter == 0) {
      setPageHeader(page, coloredStr(decodeURI(idcJson.groups[i].name), idcJson.groups[i].color.replace('#000000', '#FFFFFF')));
    }
    for (var j in idcJson.groups[i].channels) {
      var lines = decodeURI(idcJson.groups[i].channels[j].epg_progname).split('\n');
      page.appendItem(plugin.id + ':idcPlay:' + idcJson.groups[i].channels[j].id + ':' + idcJson.groups[i].channels[j].name, 'video', {
        title: new RichText(decodeURI(idcJson.groups[i].channels[j].name) +
          coloredStr(getEpgPeriod(idcJson.groups[i].channels[j].epg_start, idcJson.groups[i].channels[j].epg_end, lines[0]), orange)),
        icon: 'http://iptvn.idc.md' + idcJson.groups[i].channels[j].icon,
        description: idcJson.groups[i].channels[j].epg_progname ? decodeURI(idcJson.groups[i].channels[j].epg_progname) : null,
      });
      counter++;
    }
    break;
  };
  page.metadata.title = new RichText(page.metadata.title + ' (' + counter + ')');
  page.loading = false;
});

function getIdc(page, url) {
  showDialog = false;
  while (1) {
    page.loading = true;
    idcJson = JSON.parse(http.request(url));
    if (!idcJson.error) {
      return true;
    }

    while (1) {
      page.loading = false;
      var credentials = popup.getAuthCredentials(plugin.id, 'Idc.md requires login to continue', showDialog, 'idc');
      if (credentials.rejected) {
        page.error('Cannot continue without login/password :(');
        return false;
      }

      if (credentials && credentials.username && credentials.password) {
        page.loading = true;
        var resp = JSON.parse(http.request('https://iptvn.idc.md/api/json/login', {
          postdata: {
            login: credentials.username,
            pass: credentials.password,
            settings: 'all',
          },
        }));
        page.loading = false;
        if (!resp.error) break;
        popup.message(resp.error.message, true);
      }
      showDialog = true;
    }
  }
}

new page.Route(plugin.id + ':idcStart', function(page) {
  setPageHeader(page, 'Idc.md');
  page.loading = true;
  if (!getIdc(page, 'https://iptvn.idc.md/api/json/channel_list')) return;
  var counter = 0;
  for (var i in idcJson.groups) {
    page.appendItem(plugin.id + ':idcGroups:' + idcJson.groups[i].id, 'directory', {
      title: new RichText(coloredStr(decodeURI(idcJson.groups[i].name), idcJson.groups[i].color.replace('#000000', '#FFFFFF'))),
    });
    counter++;
  };
  page.metadata.title = 'Idc.md (' + counter + ')';
  page.loading = false;
});

new page.Route(plugin.id + ':playgoAtDee:(.*):(.*)', function(page, url, title) {
  page.loading = true;
  page.metadata.title = unescape(title);
  var link = null;
  var doc = http.request('http://goatd.net/' + unescape(url)).toString();
  match = doc.match(/swidth=[\s\S]*?src="([\s\S]*?)"/); // extract embed url
  if (match) {
    log(match[1]);
    doc = http.request(match[1], { // loading document.write redirect page
      headers: {
        'Host': 'www.sawlive.tv',
        'Referer': 'http://goatd.net/' + unescape(url),
        'User-Agent': UA,
      },
    }).toString();
    match = doc.match(/var[\s\S]*?"([\s\S]*?);([\s\S]*?)"/);
    // fetching crypted html
    var referer = 'http://www.sawlive.tv/embed/stream/' + match[2] + '/' + match[1];
    doc = http.request(referer, {
      headers: {
        'Host': 'www.sawlive.tv',
        'Referer': 'http://goatd.net/' + unescape(url),
        'User-Agent': UA,
      },
      debug: service.debug,
    }).toString();
    log(doc);

    // 1-streamer, 2-playpath
    match = doc.match(/sowrite\("[\s\S]*?", "([\s\S]*?)", "([\s\S]*?)"/);
    if (match) {
      var playpath = match[1].replace('17264311', '').replace('11123346', '');
      var link = match[2] + ' playpath=' + playpath + ' swfUrl=http://static3.sawlive.tv/player.swf pageUrl=' + referer;
    }
  }
  playUrl(page, link, plugin.id + ':playgoAtDee:' + url + ':' + title, unescape(title));
});

new page.Route(plugin.id + ':goAtDeeStart', function(page) {
  setPageHeader(page, 'goATDee.Net');
  page.loading = true;
  var doc = http.request('http://goatd.net').toString();
  page.appendItem('', 'separator', {
    title: doc.match(/<b>([\s\S]*?)<\/b>/)[1],
  });
  // 1-am/pm time, 2-est time, 3-icon, 4-link, 5-title, 6-cet time
  var re = /<td align="right"><b>([\s\S]*?)<\/b><\/td><td align="left"><b>([\s\S]*?)<\/b><\/td>[\s\S]*?<img src="([\s\S]*?)"[\s\S]*?<a href="([\s\S]*?)"[\s\S]*?blank">([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/g;
  // 1- 6-24h time, 2-cet time
  var re2 = /<td align="right"><b>([\s\S]*?)<\/b><\/td><td align="left"><b>([\s\S]*?)<\/b>/;
  var match = re.exec(doc);
  while (match) {
    var params = re2.exec(match[6]);
    cet = '';
    if (params) {
      cet = ' / ' + params[1] + ' ' + params[2];
    }
    page.appendItem(plugin.id + ':playgoAtDee:' + escape(match[4]) + ':' + escape(match[5]), 'video', {
      title: new RichText(match[5] + (match[1] ? coloredStr(' ' + match[1] + ' ' + match[2] + cet, orange) : '')),
      icon: match[3],
      description: new RichText(match[5] + (match[1] ? coloredStr(' ' + match[1] + ' ' + match[2] + cet, orange) : '')),
    });
    match = re.exec(doc);
  }
  page.loading = false;
});

new page.Route(plugin.id + ':loadOnePlaylist', function(page) {
  setPageHeader(page, 'All channels');
  page.loading = true;
  page.metadata.title = 'Downloading M3U playlist...';
  var m3u = http.request('https://www.oneplaylist.space/database/exportall').toString();
  page.metadata.title = 'Processing the playlist...';
  m3u = m3u.match(/<div style="[\s\S]*?">([\s\S]*?)<\/div>/)[1].split('<br />');
  readAndParseM3U(page, 0, m3u);
  page.metadata.title = 'All channels (' + showM3U(page) + ')';
  page.loading = false;
});


new page.Route(plugin.id + ':onePlaylistStart', function(page) {
  setPageHeader(page, 'Oneplaylist.space - Stream Database');
  page.loading = true;
  page.appendItem(plugin.id + ':loadOnePlaylist', 'directory', {
    title: 'All channels',
  });

  var doc = http.request('http://www.oneplaylist.space').toString();

  page.appendItem('', 'separator', {
    title: 'Recently added streams',
  });
  // 1-title, 2-link
  var re = /<span style="color:#000">([\s\S]*?) \| <\/span><span style="color:#06C">([\s\S]*?)<\/span>/g;
  var match = re.exec(doc);
  while (match) {
    addItem(page, match[2], match[1]);
    match = re.exec(doc);
  }
  page.loading = false;
});

// Start page
new page.Route(plugin.id + ':start', function(page) {
  page.loading = true;
  
  if (service.selectRegion == "Off") {page.metadata.icon = logo; setPageHeader(page, "vuePRO")};
  if (service.selectRegion == "United Kingdom") {page.metadata.icon = 'https://media.baamboozle.com/uploads/images/211144/1659455637_427352.jpeg'; setPageHeader(page, "vuePRO | UK")};
  if (service.selectRegion == "United States") {page.metadata.icon = 'https://visa.express/georgia/wp-content/uploads/sites/5/2022/09/1579293111_57-83.jpg'; setPageHeader(page, "vuePRO | US")};
  if (service.selectRegion == "France") {page.metadata.icon = 'https://cdn.britannica.com/82/682-004-F0B47FCB/Flag-France.jpg'; setPageHeader(page, "vuePRO | FR")};
  if (service.selectRegion == "Canada") {page.metadata.icon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Flag_of_Canada_%28Pantone%29.svg/255px-Flag_of_Canada_%28Pantone%29.svg.png'; setPageHeader(page, "vuePRO | CA")};
  if (service.selectRegion == "Brazil") {page.metadata.icon = 'https://naurok-test2.nyc3.digitaloceanspaces.com/uploads/test/2225640/1287696/204682_1644400839.png'; setPageHeader(page, "vuePRO | BR")};
  if (service.selectRegion == "South Korea") {page.metadata.icon = 'https://logodix.com/logo/34000.jpg'; setPageHeader(page, "vuePRO | KR")};
  if (service.selectRegion == "Mexico") {page.metadata.icon = 'https://images.squarespace-cdn.com/content/v1/5223336ee4b02da2a90b23ec/1472608876004-7LB93W4U82JDKEQAOU76/Flag_of_Mexico_1917.png'; setPageHeader(page, "vuePRO | MX")};
  if (service.selectRegion == "Chile") {page.metadata.icon = 'https://i.ytimg.com/vi/7D1vZAXk1xI/maxresdefault.jpg'; setPageHeader(page, "vuePRO | CL")};
  if (service.selectRegion == "Germany") {page.metadata.icon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/1600px-Flag_of_Germany.svg.png'; setPageHeader(page, "vuePRO | DE")};
  if (service.selectRegion == "Switzerland") {page.metadata.icon = 'https://enforcetxrf.eu/wp-content/uploads/sw.jpg'; setPageHeader(page, "vuePRO | CH")};
  if (service.selectRegion == "Denmark") {page.metadata.icon = 'https://storage.needpix.com/rsynced_images/flag-983155_1280.jpg'; setPageHeader(page, "vuePRO | DK")};
  if (service.selectRegion == "Spain") {page.metadata.icon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Flag_of_Spain.svg/1500px-Flag_of_Spain.svg.png'; setPageHeader(page, "vuePRO | ES")};
  if (service.selectRegion == "Sweden") {page.metadata.icon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Flag_of_Spain.svg/1500px-Flag_of_Spain.svg.png'; setPageHeader(page, "vuePRO | ES")};
  if (service.selectRegion == "Austria") {page.metadata.icon = 'https://media.baamboozle.com/uploads/images/100175/1605219523_5895'; setPageHeader(page, "vuePRO | AT")};
  if (service.selectRegion == "Italy") {page.metadata.icon = 'https://media.baamboozle.com/uploads/images/566573/1646619025_8209.png'; setPageHeader(page, "vuePRO | IT")};
  if (service.selectRegion == "India") {page.metadata.icon = 'https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Flag_of_India.svg/1200px-Flag_of_India.svg.png'; setPageHeader(page, "vuePRO | IN")};
  if (service.selectRegion == "Norway") {page.metadata.icon = 'https://avatars.mds.yandex.net/i?id=e63347002f879e2d2baeed92a07be0aacb9ed817-12421302-images-thumbs&n=13'; setPageHeader(page, "vuePRO | NO")};


  if (service.updatechannel == "Stable") {
    page.options.createAction('update', "Check for Updates", function() 
    {
      popup.notify("Updating, please wait...", 7);
      page.redirect('https://github.com/dajesusmodz/m7-plugin-vuePRO/releases/latest/download/vuepro_stable.zip');
    });
  }

  if (service.updatechannel == "Pre-Release") {
    page.options.createAction('update', "Check for Updates", function() 
    {
      popup.notify("Updating, please wait...", 7);
      page.redirect('https://raw.githubusercontent.com/dajesusmodz/m7-plugin-vuePRO/master/vuepro_unstable.zip');
    });
  }

  if (!service.disableMyFavorites) {
  page.appendItem('', 'separator', {
    title: 'My Favorites',
  });
  page.appendItem('', 'separator', {
    title: '',
  });

  if (!service.disableMyFavorites);
  var list = eval(store.list);
    var pos = 0;
    for (var i in list) {
      if (pos >= 4) break; // Stop after listing 4 items
      var itemmd = JSON.parse(list[i]);
      var item = page.appendItem(decodeURIComponent(itemmd.link), 'playable', {
        title: decodeURIComponent(itemmd.title),
        icon: itemmd.icon ? decodeURIComponent(itemmd.icon) : null,
        description: new RichText(coloredStr('Link: ', orange) + decodeURIComponent(itemmd.link)),
      });
      addOptionForRemovingFromMyFavorites(page, item, decodeURIComponent(itemmd.title), pos);
      pos++;
    }
  }

  if (!service.disableMyFavorites) {
    var list = eval(store.list);
  
    if (!list || list.length === 0) {
      page.appendItem(plugin.id + ":start", "directory", {
        title: "Refresh",
        icon: 'https://i.postimg.cc/T1j3TpwG/refresh.png'
      });
    }
  }

  if (!service.disableMyFavorites) {
    var list = eval(store.list);
  
    if (!list || list.length === 1) {
      page.appendItem(plugin.id + ":start", "directory", {
        title: "Refresh",
        icon: 'https://i.postimg.cc/T1j3TpwG/refresh.png'
      });
    }
  }

  if (!service.disableMyFavorites) {
    var list = eval(store.list);
  
    if (!list || list.length === 2) {
      page.appendItem(plugin.id + ":start", "directory", {
        title: "Refresh",
        icon: 'https://i.postimg.cc/T1j3TpwG/refresh.png'
      });
    }
  }

  if (!service.disableMyFavorites) {
    var list = eval(store.list);
  
    if (!list || list.length === 3) {
      page.appendItem(plugin.id + ":start", "directory", {
        title: "Refresh",
        icon: 'https://i.postimg.cc/T1j3TpwG/refresh.png'
      });
    }
  }

  if (!service.disableMyFavorites) {
    var list = eval(store.list);

      if (list && list.length > 0) {
        page.appendItem(plugin.id + ":myfavs", "directory", {
          title: "Show All...",
          icon: 'https://i.postimg.cc/zGT28Cz2/favs.png'
      });
    }
  }

  // ---------------------------------------------------------- CONTENT PROVIDERS ---------------------------------------------------------- \\

  if (service.selectRegion == "Off") {
    page.appendItem('', 'separator', {title: 'Navigate to "Movian > Settings > vuePRO > Channel Region:" to watch Free Channels.'});
  }

  if (service.selectRegion == "United States") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "United Kingdom") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "France") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Canada") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Brazil") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "South Korea") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Mexico") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Chile") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Germany") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Switzerland") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Denmark") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Spain") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Sweden") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Austria") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "Italy") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "India") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }
  if (service.selectRegion == "India") {
    page.appendItem('', 'separator', {title: ' '});
    page.appendItem('', 'separator', {title: 'Channels'});
  }

  // Samsung TV Plus

  if (service.selectRegion == "United States") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/USBC1300009VM.m3u8', 'video', { title: 'LOL! Network', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/USBC1300009VM_20240213T215421SQUARE.png_20240213215422.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/USBB1900002KF.m3u8', 'video', { title: 'Real Americas Voice', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/USBB1900002KF_20221109T013546SQUARE.png_20221109013547.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/USAJ26000015Y.m3u8', 'video', { title: 'Drama Life', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/USAJ26000015Y_20221109T013415SQUARE.png_20221109013415.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/USBD700012OA.m3u8', 'video', { title: 'The Bob Ross Channel', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/USBD700012OA_20230627T215017SQUARE.png_20230627215018.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:United%20States', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "South Korea") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/KRBC3200023BG.m3u8', 'video', { title: 'Mnet 연애 리얼리티 모아보기', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/KRBC3200023BG_20240319T050755SQUARE.png', }); // 10/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/KR700003L9.m3u8', 'video', { title: 'KBS 추노', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/KR700003L9_20240319T050752SQUARE.png', }); // 10/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/KRBD2700002IV.m3u8', 'video', { title: 'TV조선 골프왕', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/KRBD2700002IV_20230913T010401SQUARE.png_20230913010402.png', }); // 10/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/KR4000020F.m3u8', 'video', { title: 'JTBC 내 아이디는 강남미인', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/KR4000020F_20240508T020759SQUARE.png', }); // 10/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:South%20Korea', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 10/05/24
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "United Kingdom") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/GBBD3100006XM.m3u8', 'video', { title: 'Sky Mix', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GBBD3100006XM_20231213T033116SQUARE.png_20231213033116.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/GBBD3100003J5.m3u8', 'video', { title: 'UKTV Play - Laughs', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GBBD3100003J5_20231213T104001SQUARE.png_20231213104002.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/GBBA330003941.m3u8', 'video', { title: 'Catfish', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GBBA330003941_20221215T020813SQUARE.png_20221215020814.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/GBBC9000062G.m3u8', 'video', { title: 'Come Dine With Me', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GBBC9000062G_20230809T053358SQUARE.png_20230809053358.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:United%20Kingdom', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "France") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/03/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/FRBA3300035UK.m3u8', 'video', { title: 'Juste Pour Rire', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/FRBA3300035UK_20230412T042644SQUARE.png_20230412042645.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/FRBC4700002RF.m3u8', 'video', { title: 'Alerte à Malibu', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/FRBC4700002RF_20231213T103950SQUARE.png_20231213103951.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/FRBC47000054S.m3u8', 'video', { title: 'Les filles d-à côté', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/FRBC47000054S_20230510T043943SQUARE.png_20230510043944.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/FRBD410000436.m3u8', 'video', { title: 'Les secrets de nos régions', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/FRBD410000436_20231115T012249SQUARE.png_20231115012250.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:France', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "Canada") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 28/03/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/CABC23000056U.m3u8', 'video', { title: 'Midsomer Murders', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CABC23000056U_20240319T022645SQUARE.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/CAAJ40000077N.m3u8', 'video', { title: 'FilmRise Free Movies', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CAAJ40000077N_20240319T022621SQUARE.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/CABA3700002ML.m3u8', 'video', { title: 'Baywatch', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CABA3700002ML_20240116T231212SQUARE.png_20240116231213.png', });
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/CABC2300008J0.m3u8', 'video', { title: 'MotorTrend FAST TV', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CABC2300008J0_20230125T022433SQUARE.png_20230125022434.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:Canada', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "Switzerland") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/CHAJ3200003RF.m3u8', 'video', { title: 'The Pet Collective', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CHAJ3200003RF_20230222T012027SQUARE.png_20230222012028.png', }); //13/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/CHBB49000054U.m3u8', 'video', { title: 'Stars in Gefahr', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CHBB49000054U_20230809T053659SQUARE.png_20230809053659.png', }); //13/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/CHAJ700007XE.m3u8', 'video', { title: 'Pluto TV Serie', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CHAJ700007XE_20230809T053648SQUARE.png_20230809053649.png', }); //13/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/CHAJ0500419A.m3u8', 'video', { title: 'Focus TV', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CHAJ0500419A_20240321T050322SQUARE.png', }); //13/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:Switzerland', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); //13/05/24
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "Spain") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ESBA140000504.m3u8', 'video', { title: 'Stormcast Novelas', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ESBA140000504_20231115T012203SQUARE.png_20231115012203.png', }); //15/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ESBA3300036W1.m3u8', 'video', { title: 'BelAir TV', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ES12000024R_20240507T094209SQUARE.png', }); //15/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ESBC4100004J1.m3u8', 'video', { title: '24H', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ESBC4100004J1_20230614T005926SQUARE.png_20230614005927.png', }); //15/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ESBC39000033J.m3u8', 'video', { title: 'El País', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ESBC39000033J_20230809T053828SQUARE.png_20230809053829.png', }); //15/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:Spain', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); //15/05/24
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "Austria") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ATAJ70000741.m3u8', 'video', { title: 'Pluto TV Serie', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ATAJ70000741_20230809T053602SQUARE.png_20230809053603.png', }); //15/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ATBA33000123Q.m3u8', 'video', { title: 'Crime Serien - Rakuten TV', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ATBA33000123Q_20230809T053609SQUARE.png_20230809053609.png', }); //15/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ATBA3300009MF.m3u8', 'video', { title: 'Zee One', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ATBA3300006WH_20230913T030501SQUARE.png_20230913030502.png', }); //15/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ATAK3504503A.m3u8', 'video', { title: 'El País', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ATAK3504503A_20220914T041035SQUARE.png_20220914041035.png', }); //15/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:Austria', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); //15/05/24
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "Italy") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ITAJ3800007P8.m3u8', 'video', { title: 'Pluto TV Serie', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ITAJ3800007P8_20220404T005740SQUARE.png_20220404005742.png', }); //16/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ITBD1100001B7.m3u8', 'video', { title: 'LA GRANDE ARTE by HOUSE OF DOCS', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ITBD1100001B7_20240402T134259SQUARE.png', }); //16/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ITBC35000016T.m3u8', 'video', { title: 'Grandi Documentari - Wedo Big Stories', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ITBC35000016T_20230926T032330SQUARE.png_20230926032331.png', }); //16/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/ITBD10000040W.m3u8', 'video', { title: 'The Boat Show', icon: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ITBD10000040W_20230823T033135SQUARE.png_20230823033135.png', }); //16/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:Italy', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); //16/05/24
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }
  if (service.selectRegion == "India") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Samsung TV Plus:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/INBD400010BD.m3u8', 'video', { title: 'ABP Asmita', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/INBD400010BD_20240131T032435SQUARE.png_20240131032436.png', }); //16/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/INBD47000014D.m3u8', 'video', { title: 'The Q', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/INBD47000014D_20240214T030802SQUARE.png_20240214030803.png', }); //16/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/INBA4900027A9.m3u8', 'video', { title: 'Real Wild', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/INBA4900027A9_20220427T054651SQUARE.png_20220427054652.png', }); //16/05/24
    page.appendItem('https://i.mjh.nz/SamsungTVPlus/INBD29000010W.m3u8', 'video', { title: 'PGA Tour', icon: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/INBD29000010W_20240131T032319SQUARE.png_20240131032320.png', }); //16/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FSamsungTVPlus%2Fall.m3u8:India', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); //16/05/24
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: ''});
  }

  // Pluto TV

  if (service.selectRegion == "United States") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('https://r.mjh.nz/PlutoTV/64b585f84ea480000838e446-alt.m3u8', 'playable', { title: 'Pluto TV - Icons', icon: 'https://images.pluto.tv/channels/64b585f84ea480000838e446/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/633354b63df9700007f6a1b7-alt.m3u8', 'playable', { title: 'Sitcom Legends', icon: 'https://images.pluto.tv/channels/633354b63df9700007f6a1b7/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/5f99e24636d67d0007a94e6d-alt.m3u8', 'playable', { title: 'Comedy Central - Animation', icon: 'https://images.pluto.tv/channels/5f99e24636d67d0007a94e6d/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/554158e864526b29254ff105-alt.m3u8', 'playable', { title: 'FailArmy', icon: 'https://images.pluto.tv/channels/554158e864526b29254ff105/colorLogoPNG.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:USA', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "Brazil") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/64f6180130ab3300083d896b-alt.m3u8', 'playable', { title: 'PFL MMA', icon: 'https://images.pluto.tv/channels/64f6180130ab3300083d896b/colorLogoPNG.png', }); // 10/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/65df713dec9fda0008b7a81d-alt.m3u8', 'playable', { title: 'South Park: Coleção Kyle', icon: 'https://images.pluto.tv/channels/65df713dec9fda0008b7a81d/colorLogoPNG.png', }); // 10/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/5f6df6293a12e10007017396-alt.m3u8', 'playable', { title: 'A vida moderna de Rocko', icon: 'https://images.pluto.tv/channels/5f6df6293a12e10007017396/colorLogoPNG.png', }); // 10/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/6048fc47a44e540007745d2b-alt.m3u8', 'playable', { title: 'RedeTV!', icon: 'https://images.pluto.tv/channels/6048fc47a44e540007745d2b/colorLogoPNG.png', }); // 10/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Brazil', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 10/05/24
  }
  if (service.selectRegion == "United Kingdom") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('https://r.mjh.nz/PlutoTV/64ff1d3d3a0d700008b110e9-alt.m3u8', 'playable', { title: 'Robot Wars by MECH+', icon: 'https://images.pluto.tv/channels/64ff1d3d3a0d700008b110e9/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/625567abd664ea0007605f34-alt.m3u8', 'playable', { title: 'Worlds Greatest', icon: 'https://images.pluto.tv/channels/625567abd664ea0007605f34/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/62da7819be7a97000878eb92-alt.m3u8', 'playable', { title: 'CSI - Miami', icon: 'https://images.pluto.tv/channels/62da7819be7a97000878eb92/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/64edf6eaa7ec0d000812f58c-alt.m3u8', 'playable', { title: 'South Park', icon: 'https://images.pluto.tv/channels/64edf6eaa7ec0d000812f58c/colorLogoPNG.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Great%20Britain', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "France") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/03/24
    page.appendItem('https://r.mjh.nz/PlutoTV/5f8ed0720dc198000728f9d3-alt.m3u8', 'playable', { title: 'People are Awesome', icon: 'https://images.pluto.tv/channels/5f8ed0720dc198000728f9d3/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/5f8edb6df1ebb800072edf10-alt.m3u8', 'playable', { title: 'Les Nouveaux Detectives', icon: 'https://images.pluto.tv/channels/5f8edb6df1ebb800072edf10/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/63921a1bf76e7d0007c998a6-alt.m3u8', 'playable', { title: 'Enquêtes de Choc', icon: 'https://images.pluto.tv/channels/63921a1bf76e7d0007c998a6/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/60d359c98f262f00070c364e-alt.m3u8', 'playable', { title: 'Doctor Who', icon: 'https://images.pluto.tv/channels/60d359c98f262f00070c364e/colorLogoPNG.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:France', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "Canada") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 28/03/24
    page.appendItem('https://r.mjh.nz/PlutoTV/5f8ed0720dc198000728f9d3-alt.m3u8', 'playable', { title: 'Wanted: Dead or Alive', icon: 'https://images.pluto.tv/channels/6089788de5c8410007808e26/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/5efbd39f8c4ce900075d7698-alt.m3u8', 'playable', { title: 'Star Trek', icon: 'https://images.pluto.tv/channels/5efbd39f8c4ce900075d7698/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/65653817c917a5000844bc30-alt.m3u8', 'playable', { title: 'Criminal Minds', icon: 'https://images.pluto.tv/channels/65653817c917a5000844bc30/colorLogoPNG.png', });
    page.appendItem('https://r.mjh.nz/PlutoTV/5c6eeb85c05dfc257e5a50c4-alt.m3u8', 'playable', { title: 'Degrassi', icon: 'https://images.pluto.tv/channels/5c6eeb85c05dfc257e5a50c4/colorLogoPNG.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Canada', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "Mexico") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/5e793a7cfbdf780007f7eb75-alt.m3u8', 'playable', { title: 'Descubriendo Pluto TV', icon: 'https://images.pluto.tv/channels/5e793a7cfbdf780007f7eb75/colorLogoPNG.png', }); // 12/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/63eb947c4e83e70008ab877b-alt.m3u8', 'playable', { title: 'NCIS', icon: 'https://images.pluto.tv/channels/63eb947c4e83e70008ab877b/colorLogoPNG.png', }); // 12/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/656e465b9d5ac400083d2db9-alt.m3u8', 'playable', { title: 'Franky Mostro', icon: 'https://images.pluto.tv/channels/656e465b9d5ac400083d2db9/colorLogoPNG.png', }); // 12/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/62d08af527ce19000731eaa0-alt.m3u8', 'playable', { title: 'La Familia del Barrio', icon: 'https://images.pluto.tv/channels/62d08af527ce19000731eaa0/colorLogoPNG.png', }); // 12/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Mexico', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "Chile") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/625461ef01f27a0007976ad1-alt.m3u8', 'playable', { title: 'MTV Catfish', icon: 'https://images.pluto.tv/channels/625461ef01f27a0007976ad1/colorLogoPNG.png', }); // 12/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/63eb947c4e83e70008ab877b-alt.m3u8', 'playable', { title: 'NCIS', icon: 'https://images.pluto.tv/channels/63eb947c4e83e70008ab877b/colorLogoPNG.png', }); // 12/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/5dd85eac039bba0009e86d1d-alt.m3u8', 'playable', { title: 'Pluto TV Naturaleza', icon: 'https://images.pluto.tv/channels/5dd85eac039bba0009e86d1d/colorLogoPNG.png', }); // 12/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/5ea71d48af1d0b0007d837f4-alt.m3u8', 'playable', { title: 'The New Detectives', icon: 'https://images.pluto.tv/channels/5ea71d48af1d0b0007d837f4/colorLogoPNG.png', }); // 12/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Chile', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 12/05/24
  }
  if (service.selectRegion == "Germany") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/6270ea4345f5bc0007823048-alt.m3u8', 'playable', { title: 'Fury', icon: 'https://images.pluto.tv/channels/6270ea4345f5bc0007823048/colorLogoPNG.png', }); // 13/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/6523ca21a70bf000081fe675-alt.m3u8', 'playable', { title: 'South Park: Kyle Collection', icon: 'https://r.mjh.nz/PlutoTV/646b14d0e1979c0008915a09-alt.m3u8', }); // 13/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/630348a54c48ce00077eb6c7-alt.m3u8', 'playable', { title: 'Becker', icon: 'https://images.pluto.tv/channels/630348a54c48ce00077eb6c7/colorLogoPNG.png', }); // 13/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/622f40c901d4b70007ad7609-alt.m3u8', 'playable', { title: 'Sabrina - Total verhext!', icon: 'https://images.pluto.tv/channels/622f40c901d4b70007ad7609/colorLogoPNG.png', }); // 13/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Germany', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 13/05/24
  }
  if (service.selectRegion == "Denmark") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/654a3fe6986ad20008a42add-alt.m3u8', 'playable', { title: 'Langt fra Bryggen', icon: 'https://images.pluto.tv/channels/654a3fe6986ad20008a42add/colorLogoPNG.png', }); // 13/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/6464cc595a0cd500088c7749-alt.m3u8', 'playable', { title: 'Americas Next Top Model', icon: 'https://images.pluto.tv/channels/6464cc595a0cd500088c7749/colorLogoPNG.png', }); // 13/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/642af9a19189ce00088f44ab-alt.m3u8', 'playable', { title: 'Yu-Gi-Oh!', icon: 'https://images.pluto.tv/channels/642af9a19189ce00088f44ab/colorLogoPNG.png', }); // 13/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/62b9b63d3bbe9000073c0a2d-alt.m3u8', 'playable', { title: 'Wildfire', icon: 'https://images.pluto.tv/channels/62b9b63d3bbe9000073c0a2d/colorLogoPNG.png', }); // 13/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Denmark', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 13/05/24
  }
  if (service.selectRegion == "Spain") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/65dded6966eec80008947157-alt.m3u8', 'playable', { title: 'Call the Midwife', icon: 'https://images.pluto.tv/channels/65dded6966eec80008947157/colorLogoPNG.png', }); // 15/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/657868a7a620e30008fdbfeb-alt.m3u8', 'playable', { title: 'Embrujadas', icon: 'https://images.pluto.tv/channels/657868a7a620e30008fdbfeb/colorLogoPNG.png', }); // 15/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/60b4c06717da110007ee1af6-alt.m3u8', 'playable', { title: 'Pluto TV Telenovelas', icon: 'https://images.pluto.tv/channels/60b4c06717da110007ee1af6/colorLogoPNG.png', }); // 15/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/65254e8d81f9420008342cee-alt.m3u8', 'playable', { title: 'La fiebre del Jade', icon: 'https://images.pluto.tv/channels/65254e8d81f9420008342cee/colorLogoPNG.png', }); // 15/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Spain', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 15/05/24
  }
  if (service.selectRegion == "Sweden") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/65b1077e0d9ab40008245b20-alt.m3u8', 'playable', { title: 'Best of Paradise Hotel: Kyssar & kärlek', icon: 'https://images.pluto.tv/channels/65b1077e0d9ab40008245b20/colorLogoPNG.png', }); // 15/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/65d881914e01740008a36603-alt.m3u8', 'playable', { title: 'South Park: Stan Collection', icon: 'https://images.pluto.tv/channels/65d881914e01740008a36603/colorLogoPNG.png', }); // 15/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/6464cc01e1979c000889570b-alt.m3u8', 'playable', { title: 'Survivor', icon: 'https://images.pluto.tv/channels/6464cc01e1979c000889570b/colorLogoPNG.png', }); // 15/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/65a63ff00d9ab400080b101c-alt.m3u8', 'playable', { title: 'Klovn', icon: 'https://images.pluto.tv/channels/65a63ff00d9ab400080b101c/colorLogoPNG.png', }); // 15/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Sweden', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 15/05/24
  }
  if (service.selectRegion == "Italy") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/608aa42b5c2b8f0007197529-alt.m3u8', 'playable', { title: 'Pluto TV Film Drama', icon: 'https://images.pluto.tv/channels/608aa42b5c2b8f0007197529/colorLogoPNG.png', }); // 16/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/60802d37ee238e0007c94e64-alt.m3u8', 'playable', { title: 'Andromeda', icon: 'https://images.pluto.tv/channels/60802d37ee238e0007c94e64/colorLogoPNG.png', }); // 16/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/60e4507a06171800072339a3-alt.m3u8', 'playable', { title: 'Il Banco dei Pugni', icon: 'https://images.pluto.tv/channels/60e4507a06171800072339a3/colorLogoPNG.png', }); // 16/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/626bb07a58b8dd0007e9f36e-alt.m3u8', 'playable', { title: 'Case Pazzesche', icon: 'https://images.pluto.tv/channels/626bb07a58b8dd0007e9f36e/colorLogoPNG.png', }); // 16/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Italy', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 16/05/24
  }
  if (service.selectRegion == "Norway") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Pluto TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://r.mjh.nz/PlutoTV/660d64a7aec9680008f8ba77-alt.m3u8', 'playable', { title: 'Top Gear Classics', icon: 'https://images.pluto.tv/channels/660d64a7aec9680008f8ba77/colorLogoPNG.png', }); // 16/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/6400bdb1219c4c00081751aa-alt.m3u8', 'playable', { title: 'COPS', icon: 'https://images.pluto.tv/channels/6400bdb1219c4c00081751aa/colorLogoPNG.png', }); // 16/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/651582486625510008f9fbce-alt.m3u8', 'playable', { title: 'Robot Wars by MECH+', icon: 'https://images.pluto.tv/channels/651582486625510008f9fbce/colorLogoPNG.png', }); // 16/05/24
    page.appendItem('https://r.mjh.nz/PlutoTV/645cc855e1979c000875ee47-alt.m3u8', 'playable', { title: 'Svenske Truckers', icon: 'https://images.pluto.tv/channels/645cc855e1979c000875ee47/colorLogoPNG.png', }); // 16/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fi.mjh.nz%2FPlutoTV%2Fall.m3u8:Norway', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 16/05/24
  }

  // Rakuten TV

  if (service.selectRegion == "United Kingdom") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Rakuten TV:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('https://f06cd57c1eeb48fd89b80d9ff8ae230f.mediatailor.us-east-1.amazonaws.com/v1/master/0fb304b2320b25f067414d481a779b77db81760d/RakutenTV-eu_AdventureEarth/playlist.m3u8?ads.amznbrmid=&ads.amznregion=&ads.amznslots=&ads.app_version=&ads.brand_name=&ads.content_classification=0&ads.device_lmt=0&ads.device_make=chrome&ads.device_model=GENERIC&ads.device_type=web&ads.device_year=1970&ads.env=prod&ads.gdpr_consent=&ads.market=uk&ads.os_language=&ads.player_height=1080&ads.player_width=1920&ads.pod_type=playerpage_midroll&ads.ppid=e3dd2658-e93a-4cee-9d4b-27200826a904&ads.rtv_content_id=4739&ads.rtv_content_language=eng&ads.rtvid=271858&ads.streaming_id=0aa02f21-13d6-467e-be40-902135aea060&ads.tivo_devcountry=&ads.tivo_devmakedate=&ads.tivo_mvpd=&ads.tivo_platform=&ads.tivo_usid=&ads.tivo_uxloc=&ads.user_type=visitor&ads.wurl_channel=1299', 'playable', { title: 'Reuters', icon: 'https://images-2.rakuten.tv/storage/global-live-channel/translation/artwork_negative/14a6bea6-b1dc-4a60-a59a-bdf505a3ade3-reuters-1643363487.png', });
    page.appendItem('https://75bced9559e343058577aeae94f36a8c.mediatailor.us-east-1.amazonaws.com/v1/master/f4e8c53a8367a5b58e20ce054ea3ce25a3e904d3/RakutenTV-gb_Popflix/playlist.m3u8?ads.amznbrmid=&ads.amznregion=&ads.amznslots=&ads.app_version=&ads.brand_name=&ads.content_classification=15&ads.device_lmt=0&ads.device_make=chrome&ads.device_model=GENERIC&ads.device_type=web&ads.device_year=1970&ads.env=prod&ads.gdpr_consent=&ads.market=uk&ads.os_language=&ads.player_height=1080&ads.player_width=1920&ads.pod_type=playerpage_midroll&ads.ppid=e3dd2658-e93a-4cee-9d4b-27200826a904&ads.rtv_content_id=4279&ads.rtv_content_language=eng&ads.rtvid=271858&ads.streaming_id=914e56b1-9153-4296-9d97-7f7788633477&ads.tivo_devcountry=&ads.tivo_devmakedate=&ads.tivo_mvpd=&ads.tivo_platform=&ads.tivo_usid=&ads.tivo_uxloc=&ads.user_type=visitor&ads.wurl_channel=1068', 'playable', { title: 'Popflix', icon: 'https://images-3.rakuten.tv/storage/global-live-channel/translation/artwork-negative/f91913cf-c985-4973-8f70-6688d38548ae.png', });
    page.appendItem('https://lonestar-rakuten.amagi.tv/hls/amagi_hls_data_rakutenAA-lonestar-rakuten/CDN/playlist.m3u8?ads_amagi_channel=725&ads_amznbrmid=&ads_amznregion=&ads_amznslots=&ads_app_version=&ads_brand_name=&ads_content_classification=12&ads_device_lmt=0&ads_device_make=chrome&ads_device_model=GENERIC&ads_device_type=web&ads_device_year=1970&ads_env=prod&ads_gdpr_consent=&ads_market=uk&ads_os_language=&ads_player_height=1080&ads_player_width=1920&ads_pod_type=playerpage_midroll&ads_ppid=e3dd2658-e93a-4cee-9d4b-27200826a904&ads_rtv_content_id=2811&ads_rtv_content_language=eng&ads_rtvid=271858&ads_streaming_id=866d2d1e-b31e-45fa-a84a-5b89ce0fcbc9&ads_tivo_devcountry=&ads_tivo_devmakedate=&ads_tivo_mvpd=&ads_tivo_platform=&ads_tivo_usid=&ads_tivo_uxloc=&ads_user_type=visitor', 'playable', { title: 'Lone Star', icon: 'https://images-3.rakuten.tv/storage/global-live-channel/translation/artwork_negative/c5e98fcd-d269-41d5-886e-0af79ca5d43b-lone-star-1643370871.png', });
    page.appendItem('https://3bd25beecec04b169f33659a7739c10b.mediatailor.us-east-1.amazonaws.com/v1/master/04fd913bb278d8775298c26fdca9d9841f37601f/RakutenTV-eu_Filmzie/playlist.m3u8?ads.amznbrmid=&ads.amznregion=&ads.amznslots=&ads.app_version=&ads.brand_name=&ads.content_classification=12&ads.device_lmt=0&ads.device_make=chrome&ads.device_model=GENERIC&ads.device_type=web&ads.device_year=1970&ads.env=prod&ads.gdpr_consent=&ads.market=uk&ads.os_language=&ads.player_height=1080&ads.player_width=1920&ads.pod_type=playerpage_midroll&ads.ppid=e3dd2658-e93a-4cee-9d4b-27200826a904&ads.rtv_content_id=3282&ads.rtv_content_language=eng&ads.rtvid=271858&ads.streaming_id=8a452216-be6c-4ac0-8e0d-8d7ec9bd13f6&ads.tivo_devcountry=&ads.tivo_devmakedate=&ads.tivo_mvpd=&ads.tivo_platform=&ads.tivo_usid=&ads.tivo_uxloc=&ads.user_type=visitor&ads.wurl_channel=592', 'playable', { title: 'Filmzie', icon: 'https://images-0.rakuten.tv/storage/global-live-channel/translation/artwork_negative/657c9c66-75c7-4cd4-a791-5ca5aca98994-filmzie-1643623115.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fwww.apsattv.com%2Frakuten-uk.m3u:RakutenTV UK', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }

  // Redbox

  if (service.selectRegion == "United States") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Redbox:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('https://8e5a51fd84df4fd4bd64dd49cc9ccb75.mediatailor.us-east-1.amazonaws.com/v1/master/04fd913bb278d8775298c26fdca9d9841f37601f/Redbox_COPS/playlist.m3u8?ads.wurl_channel=1095&ads.wurl_name=COPS&ads.coppa=%7Bcoppa%7D&ads.subp=%7Bsubp%7D&ads.deviceid=%7Bdeviceid%7D&ads.dnt=%7Bdnt%7D&ads.sz=%7Bsz%7D&ads.idtype=%7Bidtype%7D&ads.device=%7Bdevice%7D&ads.is_roku_lat=%7Bis_roku_lat%7D&ads.us_privacy=%7Bus_privacy%7D&ads.app_bundle=%7Bapp_bundle%7D&ads.studio_name=%7Bstudio_name%7D&ads.language=%7Blanguage%7D', 'playable', { title: 'COPS', icon: 'https://images.redbox.com/images/reels/fltv/Stylized/HORIZ.jpg', });
    page.appendItem('https://dai2.xumo.com/amagi_hls_data_xumo1212A-redboxpattrn/CDN/playlist.m3u8?p=redbox&deviceid=&is_lat=', 'playable', { title: 'Pattrn', icon: 'https://image.xumo.com/v1/channels/channel/88883604/248x140.png?type=channelTile', });
    page.appendItem('https://qvchsn-hsn-2-us.redbox.wurl.tv/playlist.m3u8', 'playable', { title: 'HSN', icon: 'https://images.redbox.com/images/reels/fltv/Stylized/HSN_Redbox_248x140.jpg', });
    page.appendItem('https://inverleigh-unbeaten-redbox.amagi.tv/hls/amagi_hls_data_redboxAAA-inverleigh-unbeaten-redbox/CDN/playlist.m3u8?p=Redbox&deviceid=&is_lat=', 'playable', { title: 'Unbeaten', icon: 'https://d1hj79gnft8hfg.cloudfront.net/Unbeaten February 248x140.jpeg', });
    page.appendItem('m3u:https%3A%2F%2Fwww.apsattv.com%2Fredbox.m3u:United States', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }

  // Stirr

  if (service.selectRegion == "United States") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Stirr:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://dai.google.com/linear/hls/event/4aD5IJf0QgKUJwPbq2fngg/master.m3u8', 'playable', { title: 'STIRR | National', icon: 'https://i.mjh.nz/Stirr/.images/86de280abc.png', }); // 12/05/24
    page.appendItem('https://dai.google.com/linear/hls/event/e1QjWFRNSR2YFYGsPbkfgg/master.m3u8', 'playable', { title: 'CHARGE', icon: 'https://i.mjh.nz/Stirr/.images/8b4d0a3429.png', }); // 12/05/24
    page.appendItem('https://dai.google.com/linear/hls/event/VMzvtHhOQdOAzbV_hQKQbQ/master.m3u8', 'playable', { title: 'So...Real', icon: 'https://i.mjh.nz/Stirr/.images/9d37cac4a9.png', }); // 12/05/24
    page.appendItem('https://dai.google.com/linear/hls/event/xC8SDBfbTKCTCa20kFJQXQ/master.m3u8', 'playable', { title: 'LiveXLive', icon: 'https://i.mjh.nz/Stirr/.images/4fabd4d858.png', }); // 12/05/24
    page.appendItem('m3u:https%3A%2F%2Fi.mjh.nz%2FStirr%2Fall.m3u8:United States', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 12/05/24
  }

  // Roku

  if (service.selectRegion == "United States") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  Roku:                                                                                                                                                                                                                                                               '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('https://i.mjh.nz/Roku/5941b88c38ab50ad8b09b0d920abbae5.m3u8', 'playable', { title: 'WMX Rock', icon: 'https://images.sr.roku.com/idType/roku/context/trc/id/5941b88c38ab50ad8b09b0d920abbae5/https%3A%2F%2Fimage.roku.com%2Fbh-uploads%2Fproduction%2FinfoHUDLogo%2F1678147364704_WMX_ROCK_LOGO_HUD.png', });
    page.appendItem('https://i.mjh.nz/Roku/62b4eba68f3051c68d2beb22dc94ebbc.m3u8', 'playable', { title: 'Supermarket Sweep', icon: 'https://images.sr.roku.com/idType/roku/context/trc/id/62b4eba68f3051c68d2beb22dc94ebbc/https%3A%2F%2Fimage.roku.com%2Fbh-uploads%2Fproduction%2FinfoHUDLogo%2F1669151901470_ROKU_SMS_HUD-MONO_260X147.png', });
    page.appendItem('https://i.mjh.nz/Roku/4f4e0f3d9e1f5c8c9e627514fc5a071d.m3u8', 'playable', { title: 'Total Crime', icon: 'https://images.sr.roku.com/idType/roku/context/trc/id/4f4e0f3d9e1f5c8c9e627514fc5a071d/https%3A%2F%2Fimage.roku.com%2Fbh-uploads%2Fproduction%2FinfoHUDLogo%2F1659562945788_TotalCrime_RokuUSA_HUDcenter.png', });
    page.appendItem('https://i.mjh.nz/Roku/e6416436e5d6510e9e22c23862deea23.m3u8', 'playable', { title: 'Tastemade', icon: 'https://images.sr.roku.com/idType/roku/context/trc/id/e6416436e5d6510e9e22c23862deea23/https%3A%2F%2Fimage.roku.com%2Fbh-uploads%2Fproduction%2FinfoHUDLogo%2F1659564035273_Roku_TM_260x147.png', });
    page.appendItem('m3u:https%3A%2F%2Fi.mjh.nz%2FRoku%2Fall.m3u8:United States', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }

  // FreeTV

  if (service.selectRegion == "United States") {
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('https://buzzrota-web.amagi.tv/playlist480.m3u8', 'playable', { title: 'Buzz @', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Buzzr_logo.svg/768px-Buzzr_logo.svg.png', });
    page.appendItem('https://bcovlive-a.akamaihd.net/5e531be3ed6c41229b2af2d9bffba88d/us-east-1/6183977686001/profile_1/chunklist.m3u8', 'playable', { title: 'Retro TV', icon: 'https://i.imgur.com/PNTYOgg.png', });
    page.appendItem('https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8', 'playable', { title: 'ABC News', icon: 'https://i.imgur.com/nki2HDQ.png', });
    page.appendItem('https://cinedigm.vo.llnwd.net/conssui/amagi_hls_data_xumo1234A-docuramaA/CDN/master.m3u8', 'playable', { title: 'Docurama', icon: 'https://i.imgur.com/bNg8mze.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_usa.m3u8:USA', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "United Kingdom") {
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''}); // 20/02/24
    page.appendItem('http://92.114.85.81:8000/play/a01g/index.m3u8', 'playable', { title: 'Channel 5', icon: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cb/Channel_5_%28UK%29_2016.svg/530px-Channel_5_%28UK%29_2016.svg.png', });
    page.appendItem('http://92.114.85.81:8000/play/a00y/index.m3u8', 'playable', { title: 'ITV 1', icon: 'https://upload.wikimedia.org/wikipedia/en/thumb/1/1f/ITV1_logo_%282022%29.svg/640px-ITV1_logo_%282022%29.svg.png', });
    page.appendItem('http://92.114.85.80:8000/play/a03s', 'playable', { title: 'Challenge', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Challenge_%282016-.n.v.%29.png/640px-Challenge_%282016-.n.v.%29.png', });
    page.appendItem('https://lightning-now70s-samsungnz.amagi.tv/playlist.m3u8', 'playable', { title: 'Now 70s', icon: 'https://i.imgur.com/qiCCX5X.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_uk.m3u8:UK', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "France") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''}); // 20/03/24
    page.appendItem('https://s13.tntendirect.com/cherie25/live/playlist.m3u8', 'playable', { title: 'Chérie 25', icon: 'https://upload.wikimedia.org/wikipedia/fr/thumb/f/f0/Ch%C3%A9rie_25_logo_2015.svg/51px-Ch%C3%A9rie_25_logo_2015.svg.png', });
    page.appendItem('https://ott.tv5monde.com/Content/HLS/Live/channel(europe)/index.m3u8', 'playable', { title: 'TV5 Monde Europe', icon: 'https://i.imgur.com/uPmwTo9.png', });
    page.appendItem('http://livetv.ktv.zone/105/play.m3u8', 'playable', { title: 'France 3', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/France_3_2018.svg/899px-France_3_2018.svg.png', });
    page.appendItem('http://livetv.ktv.zone/13/play.m3u8', 'playable', { title: 'TFX', icon: 'https://upload.wikimedia.org/wikipedia/fr/thumb/8/83/TFX_logo_2018.svg/640px-TFX_logo_2018.svg.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_france.m3u8:France', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "Brazil") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://5cf4a2c2512a2.streamlock.net/dgrau/dgrau/chunklist.m3u8', 'playable', { title: 'ALL Sports Brasil', icon: 'https://i.imgur.com/wULpnYR.png', }); // 10/05/24
    page.appendItem('https://596639ebdd89b.streamlock.net/8032/8032/index.m3u8', 'playable', { title: 'COM Brazil', icon: 'https://i.imgur.com/c8ztQnF.png', }); // 10/05/24
    page.appendItem('https://tv.unisc.br/hls/test.m3u8', 'playable', { title: 'Futura', icon: 'https://upload.wikimedia.org/wikipedia/pt/d/d9/Logo-futura-horizontal.png', }); // 10/05/24
    page.appendItem('http://rbc.directradios.com:1935/rbc/rbc/live.m3u8', 'playable', { title: 'RBC', icon: 'https://portal.rbc1.com.br/public/portal/img/layout/logorbc.png', }); // 10/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_brazil.m3u8:Brazil', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 10/05/24
  }
  if (service.selectRegion == "South Korea") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('http://ye23.vip/z7z8/2021/kbs2020.php?id=1', 'playable', { title: 'KBS 1TV', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/KBS_1_logo.svg/512px-KBS_1_logo.svg.png', }); // 10/05/24
    page.appendItem('http://123.254.72.24:1935/tvlive/livestream2/playlist.m3u8', 'playable', { title: 'MBC TV', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/MBC_Drama_Plus_TV_Channel_Logo.png/1200px-MBC_Drama_Plus_TV_Channel_Logo.png', }); // 10/05/24
    page.appendItem('http://1.245.74.5:1935/live/tv/.m3u8', 'playable', { title: 'TJB TV', icon: 'https://i.imgur.com/q9Nx801.png', }); // 10/05/24
    page.appendItem('http://123.140.197.22/stream/1/play.m3u8', 'playable', { title: 'JIBS TV', icon: 'https://i.imgur.com/RVWpBoz.png', }); // 10/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_korea.m3u8:Korea', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 10/05/24
  }
  if (service.selectRegion == "Canada") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''}); // 28/03/24
    page.appendItem('https://bozztv.com/teleyupp1/teleup-ydcl2V1MVC/playlist.m3u8', 'playable', { title: 'CBC Toronto', icon: 'https://i.imgur.com/H5yEbxf.png', });
    page.appendItem('https://i.mjh.nz/PlutoTV/62cbf398b8e02600071deda5-alt.m3u8', 'playable', { title: 'Global News Halifax', icon: 'https://i.imgur.com/IpfmG93.png', });
    page.appendItem('http://152.89.62.111:8080/nXyAiP3DNp/QgOuvocpGv/223012', 'playable', { title: 'NTV', icon: 'https://i.imgur.com/b8W3Aah.png', });
    page.appendItem('http://live.canadastartv.com:1935/canadastartv/canadastartv/playlist.m3u', 'playable', { title: 'Star TV', icon: 'https://i.imgur.com/Ap54LCC.png', });
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_canada.m3u8:Canada', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', });
  }
  if (service.selectRegion == "Mexico") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('http://cls.alcarria.tv/live/alcarriatv-livestream.m3u8', 'playable', { title: 'Alcarria TV', icon: 'https://i.imgur.com/zNSuxVZ.jpg', }); // 12/05/24
    page.appendItem('http://wms30.tecnoxia.com/soelvi/abr_soelvi/playlist.m3u8', 'playable', { title: 'Hipodromo de las Americas', icon: 'https://i.imgur.com/wc8MlGw.png', }); // 12/05/24
    page.appendItem('http://dcunilive21-lh.akamaihd.net/i/dclive_1@59479/index_1_av-p.m3u8', 'playable', { title: 'MVM NoticiasⓈ', icon: 'https://i.imgur.com/dhLXN9n.png', }); // 12/05/24
    page.appendItem('http://wowzacontrol.com:1936/stream56/stream56/playlist.m3u8', 'playable', { title: 'RCG 3 Saltillo', icon: 'https://i.imgur.com/NefH5qZ.png', }); // 12/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_mexico.m3u8:Mexico', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 10/05/24
  }
  if (service.selectRegion == "Chile") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://unlimited1-cl-isp.dps.live/ucvtv2/ucvtv2.smil/playlist.m3u8', 'playable', { title: 'UCV Televisión', icon: 'https://i.imgur.com/2VL4Pts.png', }); // 12/05/24
    page.appendItem('https://sktv-forwarders.7m.pl/get.php?x=TVN', 'playable', { title: 'TVN Ⓖ', icon: 'https://i.imgur.com/WoN1dai.png', }); // 12/05/24
    page.appendItem('https://mdstrm.com/live-stream-playlist/5c0e8b19e4c87f3f2d3e6a59.m3u8', 'playable', { title: 'TV+ Ⓖ', icon: 'https://i.imgur.com/NtuZIEJ.png', }); // 12/05/24
    page.appendItem('https://origin.dpsgo.com/ssai/event/GI-9cp_bT8KcerLpZwkuhw/master.m3u8', 'playable', { title: '13 Cultura', icon: 'https://i.imgur.com/49QkKWv.png', }); // 12/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_chile.m3u8:Chile', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 12/05/24
  }
  if (service.selectRegion == "Germany") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://mcdn.daserste.de/daserste/de/master.m3u8', 'playable', { title: 'Das Erste Ⓖ', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Das_Erste_2014.svg/640px-Das_Erste_2014.svg.png', }); // 13/05/24
    page.appendItem('http://zdf-hls-15.akamaized.net/hls/live/2016498/de/veryhigh/master.m3u8', 'playable', { title: '3sat Ⓖ', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/3sat_2019.svg/640px-3sat_2019.svg.png', }); // 13/05/24
    page.appendItem('https://sdn-global-live-streaming-packager-cache.3qsdn.com/26658/26658_264_live.m3u8', 'playable', { title: 'Schlager Deluxe', icon: 'https://i.imgur.com/YPpgUOg.png', }); // 13/05/24
    page.appendItem('https://kikageohls.akamaized.net/hls/live/2022693/livetvkika_de/master.m3u8', 'playable', { title: 'KiKa Ⓖ', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Kika_2012.svg/640px-Kika_2012.svg.png', }); // 13/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_germany.m3u8:Germany', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 13/05/24
  }
  if (service.selectRegion == "Switzerland") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('http://51.91.73.99:25461/sweden/PM66f7Y43H/25849', 'playable', { title: 'SRF 1', icon: 'https://i.imgur.com/KCPHba2.png', }); // 13/05/24
    page.appendItem('https://cdnapisec.kaltura.com/p/1719221/sp/171922100/playManifest/entryId/1_t5h46v64/format/applehttp/protocol/https/a.m3u8', 'playable', { title: 'TV0', icon: 'https://i.imgur.com/5QFZ05B.png', }); // 13/05/24
    page.appendItem('http://hotiptv.site:8080/zkby2013/1d469e6d9e42/67585', 'playable', { title: 'RTS Un', icon: 'https://i.imgur.com/gWuuBZc.png', }); // 13/05/24
    page.appendItem('http://livevideo.infomaniak.com/streaming/livecast/tvm3/playlist.m3u8', 'playable', { title: 'TVM 3', icon: 'https://i.imgur.com/3v6iZE6.png', }); // 13/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_switzerland.m3u8:Switzerland', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 13/05/24
  }
  if (service.selectRegion == "Denmark") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://drlive01texthls.akamaized.net/hls/live/2014186/drlive01text/master.m3u8', 'playable', { title: 'DR1 Ⓖ', icon: 'https://i.imgur.com/wEq8UnG.png', }); // 13/05/24
    page.appendItem('https://drlive02texthls.akamaized.net/hls/live/2014188/drlive02text/master.m3u8', 'playable', { title: 'DR2 Ⓖ', icon: 'https://i.imgur.com/b79UKYN.png', }); // 13/05/24
    page.appendItem('https://drlive03texthls.akamaized.net/hls/live/2014191/drlive03text/master.m3u8', 'playable', { title: 'DR Ramasjang Ⓖ', icon: 'https://i.imgur.com/YD0z2mN.png', }); // 13/05/24
    page.appendItem('https://cdnapi.kaltura.com/p/2158211/sp/327418300/playManifest/entryId/1_24gfa7qq/protocol/https/format/applehttp/a.m3u8', 'playable', { title: 'Folketinget TV', icon: 'https://i.imgur.com/RqQDUzX.png', }); // 13/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_denmark.m3u8:Denmark', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 13/05/24
  }
  if (service.selectRegion == "Spain") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://rtvelivestream-clnx.rtve.es/rtvesec/la1/la1_main_720.m3u8', 'playable', { title: 'La 1', icon: 'https://i.imgur.com/NbesiPn.png', }); // 15/05/24
    page.appendItem('https://rtvelivestream-clnx.rtve.es/rtvesec/24h/24h_main_720.m3u8', 'playable', { title: '24h', icon: 'https://i.imgur.com/ZKR2jKr.png', }); // 15/05/24
    page.appendItem('https://rtvelivestream-clnx.rtve.es/rtvesec/clan/clan_main_720.m3u8', 'playable', { title: 'clan', icon: 'https://i.imgur.com/38xIfQ3.png', }); // 15/05/24
    page.appendItem('https://laotrahls2-live-hls.secure2.footprint.net/egress/chandler/telemadrid/laotra_1/bitrate_1.m3u8', 'playable', { title: 'La Otra', icon: 'https://i.imgur.com/W1UZyXH.png', }); // 15/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_spain.m3u8:Spain', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 15/05/24
  }
  if (service.selectRegion == "Sweden") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://ed2.cdn.svt.se/ed7/d1/c/se/svt1/manifest.mpd?defaultSubLang=1', 'playable', { title: 'SVT 1 Ⓖ', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/SVT1_logo_2016.svg/800px-SVT1_logo_2016.svg.png', }); // 15/05/24
    page.appendItem('https://ed2.cdn.svt.se/ed7/d1/c/se/svt2/manifest.mpd?defaultSubLang=1', 'playable', { title: 'SVT 2 Ⓖ', icon: 'https://i.imgur.com/iB3veGx.png', }); // 15/05/24
    page.appendItem('https://ed2.cdn.svt.se/ed7/d1/c/se/svtk/manifest.mpd?defaultSubLang=1', 'playable', { title: 'Kunskapskanalen Ⓖ', icon: 'https://i.imgur.com/9YBxoGc.png', }); // 15/05/24
    page.appendItem('https://edg03-prd-se-ixn.solidtango.com/edge/451iw2h/playlist.m3u8', 'playable', { title: 'Öppna Kanalen Stockholm Ⓢ', icon: 'https://i.imgur.com/GWlstv5.png', }); // 15/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_sweden.m3u8:Sweden', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 15/05/24
  }
  if (service.selectRegion == "Austria") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://orf1.mdn.ors.at/out/u/orf1/q8c/manifest.m3u8', 'playable', { title: 'ORF 1 Ⓖ', icon: 'https://i.imgur.com/ft2LuRl.jpg', }); // 15/05/24
    page.appendItem('https://orfs.mdn.ors.at/out/u/orfs/q8c/manifest.m3u8', 'playable', { title: 'ORF Sport + Ⓖ', icon: 'https://i.imgur.com/MVNZ4gf.png', }); // 15/05/24
    page.appendItem('https://rbmn-live.akamaized.net/hls/live/2002825/geoSTVATweb/master.m3u8', 'playable', { title: 'Servus TV Ⓖ', icon: 'https://i.imgur.com/zDWhSxq.png', }); // 15/05/24
    page.appendItem('http://p3-6.mov.at:1935/live/weekstream/playlist.m3u8', 'playable', { title: 'P3TV', icon: 'https://i.imgur.com/1sPhZ57.png', }); // 15/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_sweden.m3u8:Sweden', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 15/05/24
  }
  if (service.selectRegion == "Italy") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=308718&output=7&forceUserAgent=raiplayappletv', 'playable', { title: 'Rai 2 Ⓖ', icon: 'https://i.imgur.com/zA0PTcs.png', }); // 15/05/24
    page.appendItem('https://d15umi5iaezxgx.cloudfront.net/LA7/CLN/HLS-B/Live.m3u8', 'playable', { title: 'La7', icon: 'https://i.imgur.com/F90mpSa.png', }); // 15/05/24
    page.appendItem('https://live02-seg.msf.cdn.mediaset.net/live/ch-lb/lb-clr.isml/index.m3u8', 'playable', { title: '20 Mediaset Ⓖ', icon: 'https://i.imgur.com/It13jwX.png', }); // 15/05/24
    page.appendItem('https://live02-seg.msf.cdn.mediaset.net/live/ch-ki/ki-clr.isml/index.m3u8', 'playable', { title: 'Iris Ⓖ', icon: 'https://i.imgur.com/Ixz1BY3.png', }); // 15/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_italy.m3u8:Italy', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 15/05/24
  }
  if (service.selectRegion == "India") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://ndtvindiaelemarchana.akamaized.net/hls/live/2003679/ndtvindia/master.m3u8', 'playable', { title: 'NDTV India', icon: 'https://i.imgur.com/QjJYohG.png', }); // 16/05/24
    page.appendItem('https://abplivetv.akamaized.net/hls/live/2043010/hindi/master.m3u8', 'playable', { title: 'ABP News', icon: 'https://i.imgur.com/DKHUFVQ.png', }); // 16/05/24
    page.appendItem('https://www.youtube.com/doordarshan/live', 'playable', { title: 'DD News Ⓨ', icon: 'https://i.imgur.com/znnVCEf.png', }); // 16/05/24
    page.appendItem('https://www.youtube.com/DDIndia/live', 'playable', { title: 'DD India Ⓨ', icon: 'https://i.imgur.com/45uptR8.png', }); // 16/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_india.m3u8:India', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 15/05/24
  }
  if (service.selectRegion == "Norway") {
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('', 'separator', {title: '  OTA TV:                                                                                                                                                                                                                                                                                 '});
    page.appendItem('', 'separator', {title: ''});
    page.appendItem('https://nrk-nrk1.akamaized.net/21/0/hls/nrk_1/playlist.m3u8', 'playable', { title: 'NRK1 Ⓖ', icon: 'https://i.imgur.com/9tj8ds7.png', }); // 16/05/24
    page.appendItem('https://nrk-nrk2.akamaized.net/22/0/hls/nrk_2/playlist.m3u8', 'playable', { title: 'NRK2 Ⓖ', icon: 'https://i.imgur.com/SiAdoK9.png', }); // 16/05/24
    page.appendItem('https://ws31-hls-live.akamaized.net/out/u/1416253.m3u8', 'playable', { title: 'TV 2 Sport 1', icon: 'https://i.imgur.com/asKHqNZ.png', }); // 16/05/24
    page.appendItem('https://frikanalen.no/stream/index.m3u8', 'playable', { title: 'Frikanalen', icon: 'https://i.imgur.com/rY3Owxl.png', }); // 16/05/24
    page.appendItem('m3uGroup:https%3A%2F%2Fraw.githubusercontent.com%2FFree-TV%2FIPTV%2Fmaster%2Fplaylists%2Fplaylist_norway.m3u8:Norway', 'directory', { title: 'Show All...', icon: 'https://i.postimg.cc/cJLV4kMN/seemore.png', }); // 15/05/24
  }

  // User Playlists

  page.appendItem('', 'separator', {title: ''});
  page.appendItem('', 'separator', {title: 'User Playlists'});
  page.appendItem('', 'separator', {title: ''});

  var list = eval(playlists.list);

    if (!list || !list.toString()) {
      page.appendItem('', 'separator', {
        title: 'You can add your own .M3U/.XML playlist in the side menu!',
      });
      page.appendItem('', 'separator', {
        title: '',
      });
    }

  addActionToTheItem(page, 'Add Custom M3U Playlist', '1Hbuve6', 'M3U');
  addActionToTheItem(page, 'Add Custom XML Playlist', '1zVA91a', 'XML');

  // menu to delete playlists
  page.options.createAction('rmPlaylist', 'Remove Playlist...', function() {
    var list = eval(playlists.list);
    for (var i in list) {
      var result = popup.message('Do you want to remove \'' + decodeURIComponent(JSON.parse(list[i]).title) + '\' playlist?', true, true);
      if (result) {
        popup.notify('\'' + decodeURIComponent(JSON.parse(list[i]).title) + '\' has been removed from from the list.', 3);
        list.splice(i, 1);
        playlists.list = JSON.stringify(list);
        page.flush();
        page.redirect(plugin.id + ':start');
      }
    }
    if (!i) popup.notify('There are no playlists to delete.', 3);
  });

  showPlaylist(page);

  page.appendItem('', 'separator', {title: ''});
  page.appendItem('', 'separator', {title: '  vuePRO Version:  3.2 (Release)                                                                                                                                                                                                                                                          '});
  page.appendItem('', 'separator', {title: ''});

  page.loading = false;
});

// My Favorites Page
new page.Route(plugin.id + ':myfavs', function(page) {
  page.metadata.icon = 'https://i.postimg.cc/zGT28Cz2/favs.png';
  setPageHeader(page, "My Favorites");
  popup.notify("Empty My Favorites in the Side-Menu", 7);

  page.options.createAction('cleanFavorites', 'Empty My Favorites', function() {
    store.list = '[]';
    popup.notify('Favorites has been emptied successfully', 3);
    page.redirect(plugin.id + ':start');
  });

  var list = eval(store.list);
    var pos = 0;
    for (var i in list) {
      var itemmd = JSON.parse(list[i]);
      var item = page.appendItem(decodeURIComponent(itemmd.link), 'video', {
        title: decodeURIComponent(itemmd.title),
        icon: itemmd.icon ? decodeURIComponent(itemmd.icon) : null,
        description: new RichText(coloredStr('Link: ', orange) + decodeURIComponent(itemmd.link)),
      });
      addOptionForRemovingFromMyFavorites(page, item, decodeURIComponent(itemmd.title), pos);
      pos++;
    }
});  

// TIVIX
o = {
  y: 'xx???x=xx??x?=',
};
// function fd2(x) {
//     var a;
//     eval(decode('#2aHR0cDovL3t2//OTcwZTYzMmUtMm//MzNmM2I4N2EtMWM3Yy00MDc2LWE2ODktNTVjNTZh//Y2UyMTczZjctZjAwNC00Njk5LWFmYmQtYzEwNzQ3MzYyZmQ0NmQwOWQ3Q4MC00N2M5LTg1ZTMtMjkxMGM0MmNiOGRmMn06e3YzfS9oMi9pbmRleC5tM3U4P3dtc0F1dGhTaWduPTE1ODAxODk2MzVTZWQxNzhhMDI1MzUwNTg4MzFkNjBkNjlhYzE2ZGEzM2RTOD//M//NDRkMWU0NjctZjI0Ni00NjY5LTkyZTEtOGVlNmI2YjNiMzE02Q0Nzg4ZjUtZWY1MC00MzI5LWFmYjYtYzQwMGFlMDg5N2ZhZoNzNoMDloMjEy'));
//     return a
// }

function fd2(x) {
  var a;
  a = x.substr(2);
  for (var i = 4; i > -1; i--) {
    if (exist(v['bk' + i])) {
      if (v['bk' + i] != '') {
        a = a.replace(v.file3_separator + b1(v['bk' + i]), '');
      }
    }
  }
  try {
    a = b2(a);
  } catch (e) {
    a = '';
  }

  function b1(str) {
    // console.log(unescape(str));
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
          return String.fromCharCode('0x' + p1);
        }));
  }

  function b2(str) {
    return decodeURIComponent(atob(str).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }
  return a;
}

var dechar = function(x) {
  return String.fromCharCode(x);
};
var decode = function(x) {
  if (x.substr(0, 2) == '#1') {
    return salt.d(pepper(x.substr(2), -1));
  } else if (x.substr(0, 2) == '#0') {
    return salt.d(x.substr(2));
  } else {
    return x;
  }
};
var abc = String.fromCharCode(65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122);
var salt = {
  _keyStr: abc + '0123456789+/=',
  e: function(e) {
    var t = '';
    var n, r, i, s, o, u, a;
    var f = 0;
    e = salt._ue(e);
    while (f < e.length) {
      n = e.charCodeAt(f++);
      r = e.charCodeAt(f++);
      i = e.charCodeAt(f++);
      s = n >> 2;
      o = (n & 3) << 4 | r >> 4;
      u = (r & 15) << 2 | i >> 6;
      a = i & 63;
      if (isNaN(r)) {
        u = a = 64;
      } else if (isNaN(i)) {
        a = 64;
      }
      t = t + this._keyStr.charAt(s) + this._keyStr.charAt(o) + this._keyStr.charAt(u) + this._keyStr.charAt(a);
    }
    return t;
  },
  d: function(e) {
    var t = '';
    var n, r, i;
    var s, o, u, a;
    var f = 0;
    e = e.replace(/[^A-Za-z0-9\+\/\=]/g, '');
    while (f < e.length) {
      s = this._keyStr.indexOf(e.charAt(f++));
      o = this._keyStr.indexOf(e.charAt(f++));
      u = this._keyStr.indexOf(e.charAt(f++));
      a = this._keyStr.indexOf(e.charAt(f++));
      n = s << 2 | o >> 4;
      r = (o & 15) << 4 | u >> 2;
      i = (u & 3) << 6 | a;
      t = t + dechar(n);
      if (u != 64) {
        t = t + dechar(r);
      }
      if (a != 64) {
        t = t + dechar(i);
      }
    }
    t = salt._ud(t);
    return t;
  },
  _ue: function(e) {
    e = e.replace(/\r\n/g, '\n');
    var t = '';
    for (var n = 0; n < e.length; n++) {
      var r = e.charCodeAt(n);
      if (r < 128) {
        t += dechar(r);
      } else if (r > 127 && r < 2048) {
        t += dechar(r >> 6 | 192);
        t += dechar(r & 63 | 128);
      } else {
        t += dechar(r >> 12 | 224);
        t += dechar(r >> 6 & 63 | 128);
        t += dechar(r & 63 | 128);
      }
    }
    return t;
  },
  _ud: function(e) {
    var t = '';
    var n = 0;
    var r = 0;
    var c1 = 0;
    var c2 = 0;
    while (n < e.length) {
      r = e.charCodeAt(n);
      if (r < 128) {
        t += dechar(r);
        n++;
      } else if (r > 191 && r < 224) {
        c2 = e.charCodeAt(n + 1);
        t += dechar((r & 31) << 6 | c2 & 63);
        n += 2;
      } else {
        c2 = e.charCodeAt(n + 1);
        c3 = e.charCodeAt(n + 2);
        t += dechar((r & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
        n += 3;
      }
    }
    return t;
  },
};
var pepper = function(s, n) {
  s = s.replace(/\+/g, '#');
  s = s.replace(/#/g, '+');
  var a = sugar(o.y) * n;
  if (n < 0) a += abc.length / 2;
  var r = abc.substr(a * 2) + abc.substr(0, a * 2);
  return s.replace(/[A-Za-z]/g, function(c) {
    return r.charAt(abc.indexOf(c));
  });
};
var sugar = function(x) {
  x = x.split(dechar(61));
  var result = '';
  var c1 = dechar(120);
  var chr;
  for (var i in x) {
    if (x.hasOwnProperty(i)) {
      var encoded = '';
      for (var j in x[i]) {
        if (x[i].hasOwnProperty(j)) {
          encoded += (x[i][j] == c1) ? dechar(49) : dechar(48);
        }
      }
      chr = parseInt(encoded, 2);
      result += dechar(chr.toString(10));
    }
  }
  return result.substr(0, result.length - 1);
};
var exist = function(x) {
  return x != null && typeof (x) != 'undefined';
};


var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function InvalidCharacterError(message) {
  this.message = message;
}
InvalidCharacterError.prototype = new Error();
InvalidCharacterError.prototype.name = 'InvalidCharacterError';

function btoa(input) {
  var str = String(input);
  for (
    // initialize result and counter
    var block, charCode, idx = 0, map = chars, output = '';
    // if the next str index does not exist:
    //   change the mapping table to "="
    //   check if d has no fractional digits
    str.charAt(idx | 0) || (map = '=', idx % 1);
    // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
    output += map.charAt(63 & block >> 8 - idx % 1 * 8)
  ) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 0xFF) {
      throw new InvalidCharacterError('\'btoa\' failed: The string to be encoded contains characters outside of the Latin1 range.');
    }
    block = block << 8 | charCode;
  }
  return output;
}

// decoder
// [https://gist.github.com/1020396] by [https://github.com/atk]
function atob(input) {
  var str = (String(input)).replace(/[=]+$/, ''); // #31: ExtendScript bad parse of /=
  if (str.length % 4 === 1) {
    throw new InvalidCharacterError('\'atob\' failed: The string to be decoded is not correctly encoded.');
  }
  for (
    // initialize result and counters
    var bc = 0, bs, buffer, idx = 0, output = '';
    // get next character
    buffer = str.charAt(idx++); // eslint-disable-line no-cond-assign
    // character found in table? initialize bit storage and add its ascii value;
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
    // and if not first of each 4 characters,
    // convert the first 8 bits to one ascii character
    bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
  ) {
    // try to find character in table (0-63, not found => -1)
    buffer = chars.indexOf(buffer);
  }
  return output;
}
