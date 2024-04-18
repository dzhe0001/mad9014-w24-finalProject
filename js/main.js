import {
  FilesetResolver,
  FaceDetector,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";

const API = {
  KEY: "43364069-fca7af5f0051c6383e86fa9f9",
  BASE_URL: "https://pixabay.com/api/",
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  //Main object to manipulate the storage (Cache API in this case)
  const storage = {
    instance: caches.open("picture-this-3e46R"),
    getAll: async function () {
      return (await this.instance)
        .keys()
        .then(async (keys) => {
          const promises = [];
          keys.forEach((item) => {
            promises.push(caches.match(item).then((r) => r.json()));
          });

          return Promise.allSettled(promises).then((data) => {
            const results = [];

            data.forEach((item) => {
              if (item.status === "fulfilled") {
                results.push(item.value);
              }
            });

            return results;
          });
        })
        .catch((err) => {
          console.log(err);
          return [];
        });
    },
    findOne: async function (url) {
      return (await this.instance)
        .match(url)
        .then((result) => (result ? true : false))
        .catch((err) => false);
    },
    addOne: function (url, alt) {
      this.instance
        .then(async (cache) => {
          const data = {
            alt,
            url,
          };

          const jsonResponse = new Response(JSON.stringify(data), {
            headers: {
              "content-type": "application/json",
            },
          });

          cache.put(url, jsonResponse);
        })
        .catch((err) => {
          UI.error(err.message, err.code);
          console.log(err.message);
        });
    },
    removeOne: function (url) {
      this.instance
        .then(async (cache) => {
          await cache.delete(new URL(url));
          if (getPage() === "saved") {
            UI.dialog.close();
            showPage();
          }
        })
        .catch((err) => {
          UI.error(err.message, err.code);
          console.log(err.message);
        });
    },
  };

  //Main object to manipulate the UI
  const UI = {
    search: document.getElementById("search"),
    dialog: document.getElementById("dialog"),
    loader: document.getElementById("loader"),
    images: document.getElementById("images"),
    results: document.getElementById("results"),
    menu: document.querySelector("header .menu"),
    isLoading: false,
    error: function (msg, code = 404) {
      if (msg === "") {
        msg = "An unknown error occured 😥";
      }

      if (isNaN(code) && code === "") {
        code = 500;
      }

      this.dialog.querySelector(".control-buttons").classList.add("hidden");

      const body = this.dialog.querySelector(".body");

      body.innerHTML = `<div class="error"><img src="https://http.cat/${code}" alt="${msg}" class="img" /><div class="payload"><h2>Oops... Error!</h2><p>${msg}</p></div>`;

      this.dialog.showModal();

      this.drawResults();
      this.resultsCounter();

      document.title = "Home page | Picture This";

      this.saveState();
    },
    modal: async function (content) {
      this.setIsLoading(true);
      const body = this.dialog.querySelector(".body");
      body.innerHTML = content;

      if (await storage.findOne(body.querySelector("img").src)) {
        this.dialog.querySelector(".control-buttons").classList.remove("save");
        this.dialog.querySelector(".control-buttons").classList.add("remove");
      } else {
        this.dialog.querySelector(".control-buttons").classList.add("save");
        this.dialog
          .querySelector(".control-buttons")
          .classList.remove("remove");
      }

      this.dialog.querySelector(".control-buttons").classList.remove("hidden");
      this.dialog.showModal();

      if (getPage() === "saved") {
        const img = body.querySelector("img");
        const oldSrc = img.src;
        const blob = await fetchImage(oldSrc);

        if (blob) {
          img.src = URL.createObjectURL(blob);

          const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );
          const facedetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "./js/blaze_face_short_range.tflite",
            },
          });
          const faceDetectorResult = facedetector.detect(img);

          const xRation = img.offsetWidth / img.naturalWidth; //Used in case if screen size is smaller than actual image size
          const yRation = img.offsetHeight / img.naturalHeight; //Used in case if screen size is smaller than actual image size

          if (faceDetectorResult.detections.length === 0) {
            const box = document.createElement("span");
            box.style.background = "black";
            box.style.color = "red";
            box.style.position = "absolute";
            box.style.bottom = "0.5rem";
            box.style.left = "50%";
            box.style.transform = "translateX(-50%)";
            box.style.lineHeight = "1";
            box.style.fontSize = "0.75rem";
            box.style.padding = "0.15rem";
            box.style.height = "auto";
            box.style.width = "auto";
            box.innerText = `No people detected`;
            body.append(box);
          } else {
            faceDetectorResult.detections.forEach((item) => {
              const box = document.createElement("div");
              box.style.border = "0.125rem dashed red";
              box.style.position = "absolute";

              box.style.width = `${item.boundingBox.width * xRation}px`;
              box.style.height = `${item.boundingBox.height * yRation}px`;

              box.style.top = `${item.boundingBox.originY * yRation}px`;
              box.style.left = `${item.boundingBox.originX * xRation}px`;

              box.innerHTML = `<span style="background: black;color: red;position:absolute;top:calc(100% + 4px); left: 0; right:0; line-height:1;font-size:0.75rem; padding: 0.15rem;height: auto;width:auto;">Face detected!<br/>Score: ${(
                item.categories[0].score * 100
              ).toFixed(2)}%</span>`;

              body.append(box);
            });
          }
        }

        img.src = oldSrc;
      }

      this.setIsLoading(false);
    },
    clearInput: function () {
      search.querySelector("input").value = "";
    },
    setIsLoading: function (state = true) {
      if (state) {
        this.loader.style.display = "block";
        this.search.querySelector("button").disabled = true;
        this.isLoading = true;
      } else {
        this.loader.style.display = "none";
        this.search.querySelector("button").disabled = false;
        this.isLoading = false;
      }
    },
    drawResults: function (data) {
      this.images.innerHTML = "";

      if (data) {
        if (data instanceof DocumentFragment) {
          this.images.append(data);
        } else {
          const df = new DocumentFragment();

          data.forEach((el) => {
            df.append(createImageElement(el));
          });

          this.images.append(df);
        }
      }
    },
    saveState: function (url) {
      let data = {
        results: this.results.innerText,
        images: [],
        title: document.title,
      };

      this.images.querySelectorAll(".image").forEach((item) => {
        const obj = {
          url: item.querySelector(".image__src").src,
          alt: item.querySelector(".image__src").alt,
          author: item
            .querySelector(".image__author")
            .innerText.replace("by ", ""),
        };

        data.images.push(obj);
      });

      history.pushState(data, "", url ? url : location.href);
    },
    resultsCounter: function (text = "", append = false) {
      this.clearInput();

      if (text === "") {
        this.results.innerText = "";
        this.results.style.display = "none";
      } else {
        if (append) {
          this.results.style.display = "block";
          this.results.innerText += text;
        } else {
          this.results.style.display = "block";
          this.results.innerText = text;
        }
      }
    },
  };

  showPage();
  addEventListeners();

  function addEventListeners() {
    UI.search.addEventListener("submit", (e) => {
      e.preventDefault();

      const search = e.currentTarget.querySelector("input").value;

      if (search.length === 0) {
        return UI.error("Please enter something to the search field 🥴");
      }

      return runSearch(search);
    });

    UI.dialog.addEventListener("click", (e) => {
      if (e.target.classList.contains("close-dialog")) {
        e.currentTarget
          .querySelector(".control-buttons")
          .classList.add("hidden");
        e.currentTarget.close();
      } else if (e.target.classList.contains("control-button")) {
        if (e.target.classList.contains("save")) {
          storage.addOne(
            e.currentTarget.querySelector("img").src,
            e.currentTarget.querySelector("img").alt,
            null
          );
          UI.dialog.querySelector(".control-buttons").classList.remove("save");
          UI.dialog.querySelector(".control-buttons").classList.add("remove");
        }

        if (e.target.classList.contains("remove")) {
          storage.removeOne(e.currentTarget.querySelector("img").src);
          UI.dialog.querySelector(".control-buttons").classList.add("save");
          UI.dialog
            .querySelector(".control-buttons")
            .classList.remove("remove");
        }
      }
    });

    UI.images.addEventListener("click", expandImage);

    UI.menu.addEventListener("click", (e) => {
      e.preventDefault();

      if (e.target.classList.contains("link")) {
        showPage(new URL(e.target.href));
        UI.saveState(new URL(e.target.href));
      }
    });

    window.addEventListener("popstate", (e) => {
      showPage();
    });
  }

  function expandImage(e) {
    const target = e.target;

    if (UI.isLoading) return;

    if (target.classList.contains("image__src")) {
      UI.modal(`<img
      src="${target.src}"
      alt="${target.alt}"
      />`);
    }
  }

  function runSearch(search) {
    UI.setIsLoading();

    fetch(
      `${API.BASE_URL}?key=${API.KEY}&q=${search}&orientation=horizontal&category=people&image_type=photo&per_page=30`
    )
      .then((resp) => {
        if (!resp.ok) {
          const error = new Error(resp.statusText);
          error.code = resp.status;

          throw error;
        }

        return resp.json();
      })
      .then((data) => {
        if (!data.hits || data.hits.length === 0) {
          const error = new Error("Nothing was found");
          error.code = 404;

          throw error;
        }

        UI.setIsLoading(false);

        const df = new DocumentFragment();
        const results = [];

        data.hits.forEach((item) => {
          const el = createImageElement({
            url: item.largeImageURL,
            author: item.user,
            alt: item.tags,
          });

          df.append(el);
        });

        document.title = `Search results for "${search}" | Picture This`;

        UI.resultsCounter(
          `Found ${
            data.totalHits ?? 0
          } results for your request "${search}". Loaded ${
            df.childElementCount
          } photos`
        );
        UI.drawResults(df);
        UI.saveState();
      })
      .catch((err) => {
        UI.error(err.message, err.code);
        UI.setIsLoading(false);
        console.log(err.message);
      });
  }

  function createImageElement(element) {
    const el = document.createElement("div");
    el.classList.add("image");
    el.innerHTML = `
    <img
        src=""
        alt="${element.alt}"
        class="image__src"
        />
    ${
      element.author
        ? ` <span class="image__author">by ${element.author}</span>`
        : ""
    }`;

    const imgEl = el.querySelector(".image__src");
    imgEl.src = element.url;

    return el;
  }

  async function fetchImage(url) {
    return await fetch(url)
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(resp.statusText);
        }

        return resp.blob();
      })
      .then((data) => {
        return data;
      })
      .catch((err) => {
        console.log(err);
        return null;
      });
  }

  //Used to display content depending on the current opened page
  async function showPage(url = null) {
    switch (getPage(url)) {
      case "home":
        UI.search.classList.remove("hidden");
        if (UI.menu.querySelector(".link.active")) {
          UI.menu.querySelector(".link.active").classList.remove("active");
        }

        UI.menu
          .querySelector(".link[data-page='home']")
          .classList.add("active");

        document.title = "Home page | Picture This";
        UI.drawResults();
        UI.resultsCounter();

        if (!url) {
          const data = history.state;

          if (!data) {
            UI.drawResults();
            UI.resultsCounter();
          } else {
            if (data.title) document.title = data.title;
            if (data.results || data.results === "")
              UI.resultsCounter(data.results);
            if (data.images && Array.isArray(data.images))
              UI.drawResults(data.images);
          }
        }

        break;
      case "saved":
        UI.search.classList.add("hidden");
        document.title = "Saved images | Picture this";

        UI.menu.querySelector(".link.active").classList.remove("active");
        UI.menu
          .querySelector(".link[data-page='saved']")
          .classList.add("active");

        UI.resultsCounter();

        const savedImages = await storage.getAll();

        if (savedImages.length === 0) {
          UI.resultsCounter("You haven't added anything yet...");
        } else {
          UI.resultsCounter();
        }

        UI.drawResults(
          savedImages.map((item) => {
            return {
              url: item.url,
              author: null,
              alt: item.alt,
            };
          })
        );

        break;
      default:
        UI.search.classList.add("hidden");
        document.title = "Not found | Picture this";
        UI.menu.querySelector(".link.active").classList.remove("active");
        UI.resultsCounter("404: Page not found");
        UI.drawResults();

        break;
    }
  }

  //Parses URL to get page name or returns 404, AKA **router***
  function getPage(customurl = null) {
    let url = customurl ? customurl.search : location.search;
    let page;

    if (url.length === 0) {
      page = "home";
    } else {
      url = url.substring(1, url.length);
      url = url.split("&");

      page = url.find((item) => {
        const tmp = item.split("=");

        if (tmp[0] === "page") return true;
      });

      page = page.split("=")[1];
    }

    switch (page) {
      case "saved":
        return "saved";
      case "home":
        return "home";
      default:
        return "404";
    }
  }
}
