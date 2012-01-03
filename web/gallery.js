var ajaxNavigation = history.replaceState && !navigator.appVersion.match(/Mobile/);

if (ajaxNavigation) history.replaceState(location.href, window.title, location.href);
window.onpopstate = function(event) {
    if (event.state) onStateChange(event.state);
};

function onStateChange(href) {
    if (photoViewer.isOpen()) {
        photoViewer.close();
        return;
    }

    $('#content').fadeOut();
    loadingReady = false;
    setTimeout(function() {
        if (!loadingReady)
            $('#content').empty().append('<div style="text-align: center"><img src="/img/loading.gif">Loading...</div>').show();
    }, 2000);

    $.get(href, function(html) {
        loadingReady = true;
        html = $(html);
        var header = html.filter('#header');
        document.title = header.find('#title').text();
        $('#header').replaceWith(header);

        var content = html.filter('#content');
        content.hide();
        $('#content').replaceWith(content);
        updateLayout();
        content.fadeIn();
        photoViewer.setup();
        setTimeout(initMap, 300);
    });
}

function transitionTo(href) {
    if (!ajaxNavigation) return true;

    history.pushState(href, href, href);
    onStateChange(href);
    _gaq.push(['_trackPageview', href]);
    return false;
}

function goto(href) {
    if (ajaxNavigation) transitionTo(href);
    else location.href = href;
}

function facebookButton(href) {
    if (!href) href = location.href;
    return '<iframe id="facebook-button" scrolling="no" frameborder="0" allowtransparency="true" ' +
           'src="http://www.facebook.com/plugins/like.php?href=' + href + '&layout=button_count&action=like&width=90&height=20&colorscheme=dark"></iframe>'
}

function stateURL(photo) {
    var album = location.pathname.split('/')[1];
    return '/' + album + (photo ? '/' + photo.id : '') + location.search;
}

function loadVisibleThumbs(maxCount) {
    if (!maxCount) maxCount = 10000;
	var visibleTop = $(window).scrollTop() - 150;
    var visibleBottom = visibleTop + $(window).height() + 300;

    var found = false, count = 0;
    $('img.missing').each(function() {
        var img = $(this);
        var top = img.offset().top;
        if (top >= visibleTop && top <= visibleBottom) {
            img.attr('src', img.attr('rel'));
            img.removeClass('missing');
            found = true;
        }
        else if (found) return false;
        if (++count > maxCount) return false;
    });
}

function changeUsername(username) {
    username = prompt('Show photos by Google/Picasaweb user:', username);
    if (username) goto('/?by=' + username);
}

function PhotoViewer() {
    var pv = this;
    var w = $(window);
    var wrapper, title;
    var photos = [];
    var index = 0;
    var isOpen = false;

    var pub = {
        setup: function() {
            photos = [];
            $('a.photo').click(pv.open).each(function() {
                var dim = this.rel.split('x');
                photos.push({href: this.href, width: dim[0], height: dim[1], title: this.title, id: this.id});
            });

            $('#photo-wrapper').remove();
            wrapper = $('<div id="photo-wrapper"><div class="title"></div></div>').appendTo($('body'));
            wrapper[0].ontouchstart = onTouchStart;
            wrapper[0].ontouchmove = onTouchMove;
            title = wrapper.find('.title');
            title.hover(function() {
                title.fadeOut();
            });
        },

        isOpen: function() {
            return isOpen;
        },

        open: function() {
            isOpen = true;
            onResize();
            $(document).keydown(onKeydown);
            $(window).resize(onResize);
            index = $('a.photo').index(this);
            wrapper.find('img').remove();
            wrapper.fadeIn();
            wrapper.click(onMouseClick);
            wrapper.mousemove(onMouseMove);

            loadPhoto();
            var photo = photos[index];
            if (history.pushState) history.pushState(stateURL(photo), photo.title, stateURL(photo));
            return false;
        },

        close: function() {
            isOpen = false;
            wrapper.fadeOut();
            wrapper.unbind();
            $(document).unbind('keydown');
            $(window).unbind('resize');

            if (history.replaceState) history.replaceState(stateURL(), '', stateURL());
            wrapper.find('img').remove();
        },

        next: function() {
            index++;
            if (index >= photos.length) index = 0;
            loadPhoto();
        },

        prev: function() {
            index--;
            if (index < 0) index = photos.length-1;
            loadPhoto();
        },

        first: function() {
            index = 0;
            loadPhoto();
        },

        last: function() {
            index = photos.length-1;
            loadPhoto();
        }
    };
    $.each(pub, function(name, fun) {pv[name] = fun});

    function posAction(x, y) {
        var img = wrapper.find('img');
        if (!img.length) return pv.close;
        var left = img.offset().left;
        var right = left + img.width();
        var delta = img.width() / 4;
        if (x >= left-20 && x <= left + delta) return pv.prev;
        else if (x >= right - delta && x <= right+20) return pv.next;
        else return pv.close;
    }

    var lastMousePos;
    function onMouseMove(e) {
        var newMousePos = e.pageX + ":" + e.pageY;
        if (lastMousePos != newMousePos) {
            var action = posAction(e.pageX, e.pageY);
            var cursor = action == pv.prev ? 'w-resize' : action == pv.next ? 'e-resize' : 'default';
            wrapper.css('cursor', cursor);
        }
        lastMousePos = newMousePos;
    }

    function onMouseClick(e) {
        posAction(e.pageX, e.pageY)();
        return false;
    }

    var touchStartX;
    function onTouchStart(e) {
        if (e.touches.length == 1)
            touchStartX = e.touches[0].pageX;
    }
    function onTouchMove(e) {
        if (!touchStartX) return false;
        var dx = e.touches[0].pageX - touchStartX;
        if (dx > 20) {
            pv.next();
            touchStartX = null;
            return false;
        }
        if (dx < -20) {
            pv.prev();
            touchStartX = null;
            return false;
        }
        return true;
    }

    function onKeydown(e) {
        switch (e.which) {
            case 27: pv.close(); return false;
            case 32:
            case 34:
            case 40:
            case 39: pv.next(); return false;
            case 8:
            case 33:
            case 38:
            case 37: pv.prev(); return false;
            case 36: pv.first(); return false;
            case 35: pv.last(); return false;
            default: return true;
        }
    }

    function onResize() {
        h = window.innerHeight ? window.innerHeight : w.height(); // iPhone workaround, http://bugs.jquery.com/ticket/6724
        wrapper.width(w.width()).height(h).offset({left: w.scrollLeft(), top: w.scrollTop()});
        centerImage();
        centerTitle();
    }

    function centerImage(img) {
        if (!img) img = wrapper.find('img');
        if (!img.length) return;

        var photo = photos[index];
        var ww = wrapper.width(), wh = wrapper.height();
        if (photo.width > ww || photo.height > wh) {
            if (ww / wh > photo.width / photo.height)
                img.attr('height', wh);
            else
                img.attr('width', ww);
        }
        img.css('top', (wrapper.height()-img.height())/2);
        img.css('left', (wrapper.width()-img.width())/2);
    }

    function centerTitle() {
        title.offset({left: Math.max(0, (w.width() - title.width()) / 2)});
    }

    function imageOnLoad() {
        var img = $(this);
        wrapper.append(img);
        centerImage(img);
        img.fadeIn();
        wrapper.css('cursor', 'none');

        // preload next image
        if (index < photos.length-1)
            setTimeout(function() {
                var tmp = new Image();
                tmp.src = photos[index+1].href;
            }, 100);
    }

    function loadPhoto() {
        wrapper.css('cursor', 'wait');
        wrapper.find('img').fadeOut(function() {
            $(this).remove();
        });

        var photo = photos[index];
        var newImg = new Image();
        newImg.onload = imageOnLoad;
        newImg.style.display = 'none';
        newImg.src = photo.href;

        title.text(photo.title);
        centerTitle();
        if (photo.title) title.fadeIn(); else title.fadeOut();

        var url = stateURL(photo);
        if (history.replaceState) history.replaceState(url, photo.title, url);
        _gaq.push(['_trackPageview', url]);

        // TODO show only on mouse-move or something (+on mobile devices)
//        wrapper.find('#facebook-button').remove();
//        wrapper.append(facebookButton('http://' + location.host + stateURL(photo)));
    }
}

function doSearch() {
    goto('/' + $('#search').val() + location.search);
    return false;
}

var markers = [];
var map;
function latLng(lat, lon) {
    return new google.maps.LatLng(lat, lon);
}
function initMap() {
    if (!$('#map').length) return;

    var bounds = new google.maps.LatLngBounds();
    map = new google.maps.Map($('#map')[0], {
        mapTypeId: google.maps.MapTypeId.TERRAIN,
        styles: [{
            stylers: [
              { saturation: -5 },
              { gamma: 0.38 },
              { lightness: -33 }
            ]
        }],
        streetViewControl: false,
        zoomControl: false,
        panControl: false,
        minZoom: 1
    });

    for (var i in markers) {
        var marker = new google.maps.Marker({position: markers[i].pos, map: map, title: markers[i].title});
        bounds.extend(markers[i].pos);
        function listen(i) {
            google.maps.event.addListener(marker, 'click', function() {
                $('.albums a').eq(i).click();
            });
        }
        listen(i);
        markers[i].marker = marker;
    }

    if (markers.length > 0) {
        map.fitBounds(bounds);
        map.panBy(0, 15);
    }
    else {
        map.setCenter(latLng(0, 0));
        map.setZoom(1);
    }
}

function updateLayout() {
    var photoWidth = ($('.albums').length ? 218 : 150) + 10;
    var photosInRow = Math.floor($(window).width() / photoWidth);
    var photosInColumn = Math.ceil($(window).height() / photoWidth);
    $('#content').width(photosInRow * photoWidth);
    loadVisibleThumbs(photosInRow * (photosInColumn * 2));
}

var photoViewer = new PhotoViewer();

$(function() {
    scrollTo(0, 1);
    updateLayout();
    setTimeout(initMap, 300);
    photoViewer.setup();
    $(window).resize(updateLayout);
    $(window).scroll(loadVisibleThumbs);
    $.ajaxSetup({
       error: function(req) {
           if (req.status == 0) return;
           alert('Failed: ' + req.status + ' ' + req.statusText + (req.responseText && req.responseText.length < 200 ? ': ' + req.responseText : ''));
           location.href = '/';
       }
    });
    $('a#m').attr('href', 'm' + 'ail' + 'to:' + $('a#m').attr('href') + String.fromCharCode(64) + 'gmail.com');
});
