

const auwUserEvent = {

    url: "https://handler.amarujala.com",

    
    createCookie: function (cookieName, cookieValue, minutesToExpire) {
        const date = new Date();
        date.setTime(date.getTime() + (minutesToExpire * 60 * 1000));
        document.cookie = `${cookieName}=${cookieValue}; expires=${date.toGMTString()}; path=/;`;
    },

    
    getCookie: function (cookieName) {
        const name = `${cookieName}=`;
        const allCookieArray = document.cookie.split(";");
        for (let i = 0; i < allCookieArray.length; i += 1) {
            const temp = allCookieArray[i].trim();
            if (temp.indexOf(name) === 0) {
                return temp.substring(name.length, temp.length);
            }
        }
        return "";
    },

    setCookieExpireEndOfDay: function (name, value) {
        const now = new Date();
        const expire = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        document.cookie = `${name}=${value}; expires=${expire.toGMTString()}; path=/`;
    },

    setCookieExpireEndOfMonth: function (name, value) {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        document.cookie = `${name}=${value}; expires=${endOfMonth.toGMTString()}; path=/`;
    },

    
    originTime: function () {
        const initialTime = new Date().getTime();
        sessionStorage.setItem("auw_initialTime", initialTime);
    },

    
    generateId: function (length) {
        let result = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charactersLength = characters.length;
        for (let i = 0; i < length; i += 1) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },

    
    setSessionId: function () {
        if (!sessionStorage.getItem("auw_session_id")) {
            sessionStorage.setItem("auw_session_id", auwUserEvent.generateId(25));
            if (localStorage.getItem("_recuih")) {
                let data = JSON.parse(localStorage.getItem("_recuih"));
                if (data["session_count"]) {
                    let session_count = parseInt(data["session_count"]) + 1;
                    data["session_count"] = session_count;
                    localStorage.setItem("_recuih", JSON.stringify(data));
                    return;
                }
                data["session_count"] = 1;
                localStorage.setItem("_recuih", JSON.stringify(data));
            }
        }
    },

    
    guestId: function () {
        if (!auwUserEvent.getCookie("auw_guest_id")) {
            auwUserEvent.createCookie("auw_guest_id", auwUserEvent.generateId(20), (365 * 24 * 60));
        }
    },

    
    entityType: function () {
        if (_auw_page_detail.template == undefined || _auw_page_detail.template == "") {
            return null;
        }
        return _auw_page_detail.template;
    },

    
    entityId: function () {
        if (typeof _auw_page_detail != "undefined" && _auw_page_detail) {
            if (typeof _auw_page_detail.analytics != "undefined" && typeof _auw_page_detail.analytics.id != "undefined" && _auw_page_detail.analytics.id) {
                return _auw_page_detail.analytics.id;
            }
        }
        return null;
    },

    
    userType: function () {
        if (auwUserEvent.getCookie("is_premium_user") == "1") {
            return "premium";
        }
        return "normal";
    },

    
    category: function () {
        if (_auw_page_detail) {
            if (_auw_page_detail.category == undefined || _auw_page_detail.category == "") {
                return null;
            }
            return _auw_page_detail.category;
        }
        return null;
    },

    subCategory: function () {
        if (_auw_page_detail) {
            if (_auw_page_detail.sub_category == undefined || _auw_page_detail.sub_category == "") {
                return null;
            }
            return _auw_page_detail.sub_category;
        }
        return null;
    },

    
    locationDetails: function () {
        if (typeof _auw_page_detail != "undefined" && _auw_page_detail) {
            if (typeof _auw_page_detail.city != "undefined" && _auw_page_detail.city) {
                return _auw_page_detail.city;
            }
            if (typeof _auw_page_detail.hyper != "undefined" && _auw_page_detail.hyper) {
                return _auw_page_detail.hyper;
            }
            return _auw_page_detail.state;
        }
        return null;
    },

    locationCity: function () {
        if (_auw_page_detail) {
            if (_auw_page_detail.city) {
                return _auw_page_detail.city;
            }
        };
        return null;
    },

    locationState: function () {
        if (_auw_page_detail) {
            if (_auw_page_detail.state) {
                return _auw_page_detail.state;
            }
        };
        return null;
    },

    locationHyper: function () {
        if (_auw_page_detail) {
            if (_auw_page_detail.hyper) {
                return _auw_page_detail.hyper;
            }
        };
        return null;
    },

    
    authorDetails: function () {
        if (typeof _auw_page_detail != "undefined" && _auw_page_detail) {
            if (typeof _auw_page_detail.story_writer != "undefined" && _auw_page_detail.story_writer) {
                return _auw_page_detail.story_writer;
            }
        }
        return null;
    },

    
    contentPartners: function () {
        if (typeof _auw_page_detail != "undefined" && _auw_page_detail) {
            if (typeof _auw_page_detail.content_partner != "undefined" && _auw_page_detail.content_partner) {
                return _auw_page_detail.content_partner;
            }
        }
        return null;
    },

    source: function () {
        if (typeof _auw_page_detail != "undefined" && _auw_page_detail) {
            if (typeof _auw_page_detail.request_client != "undefined" && _auw_page_detail.request_client) {
                return _auw_page_detail.request_client;
            }
        }
        return null;
    },

    tags: function () {
        if (typeof _auw_page_detail != "undefined" && _auw_page_detail) {
            if (typeof _auw_page_detail.tags != "undefined" && _auw_page_detail.tags) {
                return _auw_page_detail.tags;
            }
        }
        return null;
    },

    slugFormatter: function (value) {
        let temp_slug = value.split("/");
        temp_slug = temp_slug[temp_slug.length - 1];
        temp_slug = temp_slug.split("?");
        return temp_slug[0];
    },

    incrementStoryCount: function () {
        const story_count = auwUserEvent.getCookie("daily_story_view");
        if (story_count) {
            const d_count = parseInt(story_count) + 1;
            auwUserEvent.setCookieExpireEndOfDay("daily_story_view", d_count);
        } else {
            auwUserEvent.setCookieExpireEndOfDay("daily_story_view", 1);
            let monthly_count = auwUserEvent.getCookie("monthly_story_view");
            if (monthly_count) {
                if (!localStorage.getItem("msv")) {
                    let cookieString = `monthly_story_view=; expires=${new Date(0).toGMTString()}; path=/`;
                    document.cookie = cookieString;
                    monthly_count = 0;
                    localStorage.setItem("msv", true);
                };
                const m_count = parseInt(monthly_count) + 1;
                auwUserEvent.setCookieExpireEndOfMonth("monthly_story_view", m_count);
            } else {
                auwUserEvent.setCookieExpireEndOfMonth("monthly_story_view", 1);
            };
        };
    },

    setCookieWithRemainingTime: function (userId) {
        const currentDate = new Date();
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999); 
        const remainingTime = endOfDay.getTime() - currentDate.getTime();
        const expiryTime = new Date(currentDate.getTime() + remainingTime);

        const flag_check = auwUserEvent.getCookie("daily_visit_flag");

        if (flag_check) {
            if (flag_check === "true") {
                return true;
            } else {
                if (userId) {
                    document.cookie = `daily_visit_flag=true; expires=${expiryTime.toGMTString()}; path=/;`;
                }
                return false;
            }
        } else {
            if (userId) {
                document.cookie = `daily_visit_flag=true; expires=${expiryTime.toGMTString()}; path=/;`;
            } else {
                document.cookie = `daily_visit_flag=false; expires=${expiryTime.toGMTString()}; path=/;`;
            }
            return false;
        };
    },

    eventData: function () {
        const data = {
            landing_page: window.location.href,
            referrer: document.referrer,
            screen_height: window.screen.height,
            screen_width: window.screen.width,
            user_agent: window.navigator.userAgent,
            entity_type: auwUserEvent.entityType(),
            entity_id: auwUserEvent.entityId(),
            user_id: auwUserEvent.getCookie("_raidu"),
            parent_id: auwUserEvent.getCookie("auw_parent_id"),
            session_id: sessionStorage.getItem("auw_session_id"),
            user_type: auwUserEvent.userType(),
            location: auwUserEvent.locationDetails(),
            category: auwUserEvent.category(),
            sub_category: auwUserEvent.subCategory(),
            content_partner: auwUserEvent.contentPartners(),
            story_writer: auwUserEvent.authorDetails(),
            source: auwUserEvent.source(),
            guest_id: auwUserEvent.getCookie("auw_guest_id"),
            personalisation_location: JSON.parse(localStorage.getItem("personalisation_location")),
            event_timpestamp: Date.now(),
            tags: auwUserEvent.tags(),
            city: auwUserEvent.locationCity(),
            state: auwUserEvent.locationState(),
            hyper: auwUserEvent.locationHyper()
        };
        return data;
    },

    
    fetch: function (data) {
        if (data == null) {
            return;
        }
        fetch(`${auwUserEvent.url}/user/event`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        }).then(req => req.json()).then(response => auwUserEvent.createCookie("auw_parent_id", response.id))
            .catch(error => console.error("Error:", error));
    },


    
    loadTime: function () {
        const data = {
            userData: auwUserEvent.eventData(),
            event_type: "views",
            event_value: auwUserEvent.entityId(),
        };
        data.userData["daily_visit_flag"] = auwUserEvent.setCookieWithRemainingTime(data.userData["user_id"]);
        auwUserEvent.fetch(data);
        let result = JSON.parse(localStorage.getItem("_recuih"));

        let category = (auwUserEvent.category()) ? auwUserEvent.category() : null;
        let location = (auwUserEvent.locationDetails()) ? auwUserEvent.locationDetails() : null;
        let page = (auwUserEvent.entityType()) ? auwUserEvent.entityType() : null;
        let story_id = (auwUserEvent.entityId()) ? auwUserEvent.entityId() : null;

        if (!result.categories) {
            result["categories"] = {};
            result["locations"] = {};
            result["pages"] = {};
            result["read_stories"] = [];
            result["recent_entity_visited"] = {};

            if (category) {
                result.categories[category] = 1;
                result.recent_entity_visited["entity_type"] = "category";
                result.recent_entity_visited["entity_slug"] = category;
            };
            if (page) {
                result.pages[page] = 1;
            };
            if (location) {
                result.locations[location] = 1;
                result.recent_entity_visited["entity_type"] = "location";
                result.recent_entity_visited["entity_slug"] = location;
            };
            if (story_id) {
                result.read_stories.push(story_id);
            }
            localStorage.setItem("_recuih", JSON.stringify(result))
            return;
        };
        if (page) {
            if (result.pages[page]) {
                result.pages[page] += 1;
            } else {
                result.pages[page] = 1;
            }
        }

        if (category) {
            if (result.categories[category]) {
                result.categories[category] += 1;
                result["recent_entity_visited"] = {};
                result["recent_entity_visited"]["entity_type"] = "category";
                result["recent_entity_visited"]["entity_slug"] = category;
            } else {
                result.categories[category] = 1;
                result["recent_entity_visited"] = {};
                result["recent_entity_visited"]["entity_type"] = "category";
                result["recent_entity_visited"]["entity_slug"] = category;
            }
        }

        if (location) {
            if (result.locations[location]) {
                result.locations[location] += 1;
                result["recent_entity_visited"] = {};
                result["recent_entity_visited"]["entity_type"] = "location";
                result["recent_entity_visited"]["entity_slug"] = location;
            } else {
                result.locations[location] = 1;
                result["recent_entity_visited"] = {};
                result["recent_entity_visited"]["entity_type"] = "location";
                result["recent_entity_visited"]["entity_slug"] = location;
            }
        };

        if (story_id) {
            if (result.read_stories.length < 30) {
                if (!result.read_stories.includes(story_id)) {
                    result.read_stories.push(story_id);
                }
            } else {
                if (!result.read_stories.includes(story_id)) {
                    result.read_stories.shift();
                    result.read_stories.push(story_id);
                }
            }
        }
        result["sun_shine"] = auwUserEvent.getCookie("sun_sign");
        localStorage.setItem("_recuih", JSON.stringify(result));
    },

    customEventType: function (eventType, eventValue, entityType, entityId) {
        const data = {
            userData: auwUserEvent.eventData(),
            entity_type: entityType,
            entity_id: entityId,
            event_type: eventType,
            event_value: eventValue,
        };
        auwUserEvent.fetch(data);
    },

    readTime: function (scroll_depth) {

        let t1 = sessionStorage.getItem("auw_initialTime");
        t1 = parseInt(t1);

        let t2 = new Date().getTime();
        t2 = parseInt(t2);

        let time = Math.floor((t2 - t1) / 1000);

        sessionStorage.setItem("auw_initialTime", t2);
        sessionStorage.setItem("scroll_depth", scroll_depth);

        let t3 = parseInt(sessionStorage.getItem("readTime")) + time;
        sessionStorage.setItem("readTime", t3);

        const data = {
            userData: auwUserEvent.eventData(),
            event_type: "readtime",
            event_value: parseInt(sessionStorage.getItem("readTime")),
            page_height: $(document).height(),
            scroll_height: $(window).scrollTop(),
            scroll_depth: parseInt(scroll_depth)
        };
        auwUserEvent.fetch(data);
    },

    eventScroll: function () {
        let current_time = new Date().getTime();
        sessionStorage.setItem("auw_initialTime", current_time);
        sessionStorage.setItem("readTime", 0);
        sessionStorage.setItem("scroll_depth", 0);

        let scrollTracker = { "10": 0, "25": 0, "50": 0, "75": 0, "90": 0, "100": 0 };

        let template = auwUserEvent.entityType();
        if (template == "story" || template == "feature-story" || template == "photo-gallery") {
            return;
        } else {
            $(window).scroll(function (e) {
                let scrollTop = $(window).scrollTop();
                let docHeight = $(document).height();
                let winHeight = $(window).height();
                let scrollPercent = (scrollTop) / (docHeight - winHeight);
                let percentScrolled = Math.round(scrollPercent * 100);

                if (percentScrolled >= 10 && percentScrolled < 25) {
                    if (scrollTracker["10"] === 0) {
                        scrollTracker["10"] = 1;
                        auwUserEvent.readTime(10);
                    }
                } else if (percentScrolled >= 25 && percentScrolled < 50) {
                    if (scrollTracker["25"] === 0) {
                        scrollTracker["25"] = 1;
                        auwUserEvent.readTime(25);
                    }
                } else if (percentScrolled >= 50 && percentScrolled < 75) {
                    if (scrollTracker["50"] === 0) {
                        scrollTracker["50"] = 1;
                        auwUserEvent.readTime(50);
                    }
                } else if (percentScrolled >= 75 && percentScrolled < 90) {
                    if (scrollTracker["75"] === 0) {
                        scrollTracker["75"] = 1;
                        auwUserEvent.readTime(75);
                    }
                } else if (percentScrolled >= 90 && percentScrolled < 100) {
                    if (scrollTracker["90"] === 0) {
                        scrollTracker["90"] = 1;
                        auwUserEvent.readTime(90);
                    }
                } else if (percentScrolled === 100) {
                    if (scrollTracker["100"] === 0) {
                        scrollTracker["100"] = 1;
                        auwUserEvent.readTime(100);
                    }
                }
            });
        }
    },

    eventViewMore: function () {
        $(document.body).ready(() => {
            $(".auw_event_loadmore").on("click", () => {
                const data = {
                    userData: auwUserEvent.eventData(),
                    event_type: "view_more",
                };
                auwUserEvent.fetch(data);
                if (!localStorage.getItem("loadmore_event")) {
                    let result = {
                        "count": 1,
                        "loadmore_type": [$(this).text()]
                    }
                    localStorage.setItem("loadmore_event", JSON.stringify(result));
                    return;
                }
                let response = JSON.parse(localStorage.getItem("loadmore_event"));
                response.count = response.count + 1;
                response.story_id.push($(this).text());
                localStorage.setItem("loadmore_event", JSON.stringify(response));
            });
        });
    },

    eventBookmark: function () {
        $(document).ready(function () {
            $(".auw-bookmark").on("click", function () {
                const id = $(this).attr("data-id");
                const data = {
                    userData: auwUserEvent.eventData(),
                    event_type: "bookmark",
                    event_value: id,
                };
                auwUserEvent.fetch(data);
                let result = JSON.parse(localStorage.getItem("_recuih"));
                if (!result.bookmark_stories) {
                    result.bookmark_stories = [auwUserEvent.entityId()];
                    localStorage.setItem("_recuih", JSON.stringify(result));
                    return;
                }
                if (result["bookmark_stories"].length > 30) {
                    if (!result["bookmark_stories"].includes(auwUserEvent.entityId())) {
                        result["bookmark_stories"].shift();
                        result["bookmark_stories"].push(auwUserEvent.entityId());
                    }
                } else {
                    if (!result["bookmark_stories"].includes(auwUserEvent.entityId())) {
                        result["bookmark_stories"].push(auwUserEvent.entityId());
                    }
                }
                localStorage.setItem("_recuih", JSON.stringify(result));
            });
        });
    },

    getTags: function () {
        if (!_auw_page_detail.tags) {
            return;
        }
        const data = {
            userData: auwUserEvent.eventData(),
            event_type: "tags",
            event_value: _auw_page_detail.tags,
        };
        auwUserEvent.fetch(data);
        let result = JSON.parse(localStorage.getItem("_recuih"));
        if (!result.tags) {
            result.tags = {};
            for (var i = 0; i < _auw_page_detail.tags.length; i++) {
                let key = _auw_page_detail.tags[i];
                key = key.split(" ").join("_");
                result.tags[key] = 1;
            }
            localStorage.setItem("_recuih", JSON.stringify(result));
            return;
        };
        let temp = Object.keys(result.tags);
        _auw_page_detail.tags.forEach((item) => {
            item = item.split(" ").join("_");
            if (temp.includes(item)) {
                result.tags[item] += 1;
            } else {
                if (temp > 30) {
                    let [lowestItems] = Object.entries(result.tags).sort(([, v1], [, v2]) => v1 - v2);
                    let key = lowestItems[0];
                    delete thisIsObject[key];
                    result.tags[item] = 1;
                } else {
                    result.tags[item] = 1;
                }
            }
        });
        localStorage.setItem("_recuih", JSON.stringify(result));
    },

    eventShare: function () {
        $(document).ready(function () {
            $(".auw_event_share").on("click", function () {
                const data = {
                    userData: auwUserEvent.eventData(),
                    event_type: "share",
                    event_value: $(this).attr("share-type"),
                };
                auwUserEvent.fetch(data);
                let result = JSON.parse(localStorage.getItem("_recuih"));
                if (!result.story_share_details) {
                    result["story_share_details"] = [];
                    let temp_share_type = {
                        "shared_type": $(this).attr("share-type"),
                        "shared_type_count": 1,
                        "stories_id": [auwUserEvent.entityId()]
                    };
                    result["story_share_details"].push(temp_share_type);
                    localStorage.setItem("_recuih", JSON.stringify(result));
                    return;
                };
                let type = $(this).attr("share-type");
                let index = result["story_share_details"].findIndex(function (ele) {
                    console.log(ele.shared_type);
                    return ele.shared_type === type
                });
                if (index === -1) {
                    let temp_share_type = {
                        "shared_type": $(this).attr("share-type"),
                        "shared_type_count": 1,
                        "stories_id": [auwUserEvent.entityId()]
                    };
                    result["story_share_details"].push(temp_share_type);
                } else {
                    result["story_share_details"][index]["shared_type_count"] += 1;
                    if (result["story_share_details"][index]["stories_id"].length > 30) {
                        if (!result["story_share_details"][index]["stories_id"].includes(auwUserEvent.entityId())) {
                            result["story_share_details"][index]["stories_id"].shift();
                            result["story_share_details"][index]["stories_id"].push(auwUserEvent.entityId());
                        }
                    } else {
                        if (!result["story_share_details"][index]["stories_id"].includes(auwUserEvent.entityId())) {
                            result["story_share_details"][index]["stories_id"].push(auwUserEvent.entityId());
                        }
                    }
                }
                localStorage.setItem("_recuih", JSON.stringify(result));
            });
        });
    },

    eventSearch: function () {
        function getValue(temp) {
            const result = document.getElementById(temp);
            const data = {
                userData: auwUserEvent.eventData(),
                event_type: "search",
                event_value: result.value,
            };
            auwUserEvent.fetch(data);
            let res = JSON.parse(localStorage.getItem("_recuih"));
            if (!res.search_keywords) {
                res["search_keywords"] = {};
                res["search_keywords"][result.value] = 1;
                localStorage.setItem("_recuih", JSON.stringify(res));
                return;
            };
            if (result.value) {
                if (res["search_keywords"][result.value]) {
                    res["search_keywords"][result.value] += 1;
                } else {
                    res["search_keywords"][result.value] = 1;
                }
            }
            localStorage.setItem("_recuih", JSON.stringify(res));
        }
        if (document.getElementById("mysearch")) {
            document.getElementById("mysearch").onkeypress = function (event) {
                if (event.keyCode === 13) {
                    getValue(document.getElementById("mysearch").id);
                }
            };
            document.getElementById("mysearch-mobile").onkeypress = function (event) {
                if (event.keyCode === 13) {
                    getValue(document.getElementById("mysearch-mobile").id);
                }
            };
        }
    },

    eventBuyNow: function () {
        $(document).ready(function () {
            $(".auw_event_buynow").on("click", function () {
                const data = {
                    userData: auwUserEvent.eventData(),
                    event_type: "buynow",
                    event_value: $(this).attr("data-id"),
                };
                auwUserEvent.fetch(data);
                let result = JSON.parse(localStorage.getItem("_recuih"));
                if (!result.buynow_services) {
                    result["buynow_services"] = [$(this).attr("data-id")];
                    localStorage.setItem("_recuih", JSON.stringify(result));
                    return;
                }
                if (result["buynow_services"].length > 30) {
                    if (!result["buynow_services"].includes($(this).attr("data-id"))) {
                        result["buynow_services"].shift();
                        result["buynow_services"].push($(this).attr("data-id"));
                    }
                } else {
                    if (!result["buynow_services"].includes($(this).attr("data-id"))) {
                        result["buynow_services"].push($(this).attr("data-id"));
                    }
                }
                localStorage.setItem("_recuih", JSON.stringify(result));
            });
        });
    },

    eventPayNow: function () {
        $(document).ready(function () {
            $(".auw_event_paynow").on("click", function () {
                const amount = $("#order_gross_amount").text();
                const data = {
                    userData: auwUserEvent.eventData(),
                    event_type: "paynow",
                    event_value: parseFloat(amount),
                };
                auwUserEvent.fetch(data);
                let result = JSON.parse(localStorage.getItem("_recuih"));
                if (!result.paynow_services) {
                    result["paynow_services"] = [$(this).attr("data-id")];
                    localStorage.setItem("_recuih", JSON.stringify(result));
                    return;
                }
                if (result["paynow_services"].length > 30) {
                    if (!result["paynow_services"].includes($(this).attr("data-id"))) {
                        result["paynow_services"].shift();
                        result["paynow_services"].push($(this).attr("data-id"));
                    }
                } else {
                    if (!result["paynow_services"].includes($(this).attr("data-id"))) {
                        result["paynow_services"].push($(this).attr("data-id"));
                    }
                }
                localStorage.setItem("_recuih", JSON.stringify(result));
            });
        });
    },

    _recuih: function () {
        if (localStorage.getItem("_recuih")) {
            let result = JSON.parse(localStorage.getItem("_recuih"));
            if (result["user_id"] === auwUserEvent.getCookie("_raidu")) {
                result["user_id"] = auwUserEvent.getCookie("_raidu");
                localStorage.setItem("_recuih", JSON.stringify(result));
            } else {
                if (result.user_id.length === 0) {
                    result["user_id"] = auwUserEvent.getCookie("_raidu");
                    localStorage.setItem("_recuih", JSON.stringify(result));
                } else {
                    const result = {};
                    localStorage.setItem("_recuih", JSON.stringify(result));
                    const data = {
                        user_type: auwUserEvent.userType(),
                        guest_id: auwUserEvent.getCookie("auw_guest_id"),
                        user_id: auwUserEvent.getCookie("_raidu")
                    };
                    localStorage.setItem("_recuih", JSON.stringify(data));
                }
            }
        } else {
            const data = {
                user_type: auwUserEvent.userType(),
                guest_id: auwUserEvent.getCookie("auw_guest_id"),
                user_id: auwUserEvent.getCookie("_raidu")
            };
            localStorage.setItem("_recuih", JSON.stringify(data));
        }
    },
    timeDiff: function () {
        let t1 = new Date().getTime();
        let currentTime = new Date().toISOString();
        currentTime = currentTime.split("T");
        let t2 = new Date(`${currentTime[0]}T23:59:59.999`).getTime();
        let t3 = t2 - t1;
        let date = new Date();
        date.setTime(date.getTime() + t3);
        return date;
    },
    localEventCall: function () {
        if (!auwUserEvent.getCookie("_auwLocal")) {
            document.cookie = `_auwLocal=true; expires=${auwUserEvent.timeDiff()}; path=/`;
            
            
            
            
            
            
            
            
            
            
            
            
            
        }
    },

    incrementSession: function () {
        let flag = JSON.parse(localStorage.getItem("sflag"));
        if (flag) {
            return;
        };
        let scount = JSON.parse(localStorage.getItem("_ul30d"));
        if (scount) {
            if (scount < 30) {
                scount = parseInt(scount) + 1;
                localStorage.setItem("_ul30d", JSON.stringify(scount));
            }
            localStorage.setItem("sflag", true);
        } else {
            localStorage.setItem("_ul30d", 1);
            localStorage.setItem("sflag", true);
        };
    },

    datesAreOnSameDay: function () {
        let first = new Date();
        let second = localStorage.getItem("preTime") ? new Date(localStorage.getItem("preTime")) : new Date();

        let a = first.getFullYear() === second.getFullYear();
        let b = first.getMonth() === second.getMonth();
        let c = first.getDate() === second.getDate();
        if (a && b && c) {
            localStorage.setItem('preTime', first);
            auwUserEvent.incrementSession();
            return true;
        }
        localStorage.setItem('preTime', first);
        localStorage.setItem("sflag", false);
        auwUserEvent.incrementSession();
    },

    setDailyStoryViewCount: function () {
        let template = auwUserEvent.entityType();
        if (template == "story" || template == "feature-story" || template == "photo-gallery") {
            auwUserEvent.incrementStoryCount();
        };
    },

    qualityReadTime: function () {
        let template = _auw_page_detail ? _auw_page_detail.template : null;
        if (template=="story" || template=="feature-story" || template=="photo-gallery" || template=="wiki" || template=="live" || template=="blog" || template=="video" || template=="videoshots") {
            if(_auw_page_detail?.expected_read_time) {
                let expected_time = parseInt(_auw_page_detail.expected_read_time) * 1000;        
                setTimeout(() => {
                    const data = {
                        userData: auwUserEvent.eventData(),
                        event_type: "QUALITY_READ",
                        event_value: true,
                    };
                    auwUserEvent.fetch(data);
                }, expected_time);
            };
        };
    }
};

document.addEventListener("visibilitychange", (event) => {
    if (document.visibilityState == "visible") {
        let current_time = new Date().getTime();
        sessionStorage.setItem("auw_initialTime", current_time);
        sessionStorage.setItem("readTime", 0);
    } else {
        let t1 = sessionStorage.getItem("auw_initialTime");
        t1 = parseInt(t1);

        let t2 = new Date().getTime();
        t2 = parseInt(t2);

        let time = Math.floor((t2 - t1) / 1000);
        const data = {
            userData: auwUserEvent.eventData(),
            event_type: "readtime",
            event_value: parseInt(time),
            page_height: $(document).height(),
            scroll_height: $(window).scrollTop(),
            scroll_depth: parseInt(sessionStorage.getItem("scroll_depth"))
        };
        auwUserEvent.fetch(data);
    }
});



try {
    auwUserEvent.originTime();
    auwUserEvent.guestId();
    auwUserEvent._recuih();
    auwUserEvent.setSessionId();
    auwUserEvent.loadTime();
    auwUserEvent.setDailyStoryViewCount();
    auwUserEvent.eventBookmark();
    auwUserEvent.eventShare();
    auwUserEvent.eventSearch();
    auwUserEvent.eventBuyNow();
    auwUserEvent.eventPayNow();
    auwUserEvent.eventScroll();
    auwUserEvent.datesAreOnSameDay();
    auwUserEvent.qualityReadTime();
} catch (error) { console.log(error); };

window.addEventListener('message', (event) => {
    

    const { eventType, currentTime } = event.data;
    if (eventType) {
        const event = eventType ? eventType.toUpperCase() : null;
        const data = {
            userData: auwUserEvent.eventData(),
            event_type: event,
            event_value: currentTime || null,
        };
        auwUserEvent.fetch(data);
    };
});