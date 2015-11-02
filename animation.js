(function() {
	var Phy = {
		K: 0.02, // elasticity / mass: bigger value means more rigid netwok
		PointerK: 0.002, // "elasticity" of attraction to pointer
		Fric: 0.9, // smaller value means faster slowdown
		Interval: 40, // ms
		Anchors: false,
		WheelTimeDelta: 500 // ms
	};

	function Link(elem) {
		this.el = $(elem);
		
		this.fromNode = null;
		this.toNode = null;

		this.fromNodeId = parseInt(this.el.data("from-node"));
		this.toNodeId = parseInt(this.el.data("to-node"));

		this.parentEl = this.el.closest(".hx-base");
		this.origin = null;

		this.getCoordinates = function() {
			return {
				x0: this.fromNode.pos.x,
				y0: this.fromNode.pos.y,
				x1: this.toNode.pos.x,
				y1: this.toNode.pos.y
			};
		};

		this.move = function(x0, y0, x1, y1) {
			var dx = x1 - x0;
			var dy = y1 - y0;
			var len = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
			var phi = Math.atan2(dy, dx);
			var w = this.parentEl.width();
			var h = this.parentEl.height();

			this.el.css("transform-origin", "0 50%");
			this.el.css("transform", "translateY(-50%) translate(" + w * x0 / 100.0 + "px," + h * y0 / 100.0 + "px)" +
				"rotate(" + phi + "rad) scaleX(" + w * len / 100.0 + ")");
		};

		this.update = function() {
			var c = this.getCoordinates();
			this.move(c.x0, c.y0, c.x1, c.y1);
		};

		this.setFrom = function(from) {
			this.fromNode = from;
			if(this.fromNode && this.toNode) this.origin = this.getCoordinates();
		};

		this.setTo = function(to) {
			this.toNode = to;
			if(this.fromNode && this.toNode) this.origin = this.getCoordinates();
		};

	}

	function Node(elem, page) {
		this.el = $(elem);
		this.parentEl = this.el.closest(".hx-base");
		this.nodeId = parseInt(this.el.data("node-id"));
		this.nailed = Boolean(this.el.data("nailed"));
		this.kmul = this.el.data("kmul");
		if(this.kmul === undefined) {
			this.kmul = 1.0;
		}
		this.page = page;
		this.links = [];

		this.getPos = function() {
			return {
				x: parseFloat(this.el.data("left")),
				y: parseFloat(this.el.data("top"))
			};
		};

		this.originPos = this.getPos();
		this.pos = this.originPos;
		this.newPos = this.originPos;
		this.vel = {x: 0.0, y: 0.0};

		this.update = function() {
			var w = this.parentEl.width();
			var h = this.parentEl.height();

			this.el.css("transform", "translate(-50%, -50%) " +
				"translate(" + w * this.pos.x / 100.0 + "px," + h * this.pos.y / 100.0 + "px) rotate(0.001deg)");
		};

		this.move = function(x, y) {
			if(!this.nailed && (x != this.pos.x || y != this.pos.y)) {
				this.pos = {x: x, y: y};
				this.update();

				if(this.page.draggingNode === this) {
					for(var i = 0; i < this.links.length; i++) {
						this.links[i].update();
					}
				}
			}
		};

		this.reset = function() {
			this.move(this.originPos.x, this.originPos.y);
		};

		this.addLinks = function(links) {
			this.links = this.links.concat(links);
			for(var i = 0; i < links.length; i++) {
				if(links[i].fromNodeId == this.nodeId) {
					links[i].setFrom(this);
				} else if(links[i].toNodeId == this.nodeId) {
					links[i].setTo(this);
				}
			}
		};

		this.calcForces = function() {
			if(this.nailed || this.page.draggingNode === this) {
				this.vel = {x: 0.0, y: 0.0};
				this.newPos = this.pos;
				return false;
			}

			var dx = 0.0, dy = 0.0;
			for(var i = 0; i < this.links.length; i++) {
				var link = this.links[i];
				var lpos = link.getCoordinates();
				var ldx = lpos.x1 - lpos.x0 - link.origin.x1 + link.origin.x0;
				var ldy = lpos.y1 - lpos.y0 - link.origin.y1 + link.origin.y0;

				if(link.fromNode == this) {
					ldx = -ldx;
					ldy = -ldy;
				}
				dx += ldx;
				dy += ldy;
			}

			// "Anchor" link
			if(Phy.Anchors) {
				dx += this.pos.x - this.originPos.x;
				dy += this.pos.y - this.originPos.y;
			}

			var kmuladd = this.page.running ? 1.0 : 4.0;
			this.vel.x -= dx * Phy.K * this.kmul * kmuladd;
			this.vel.y -= dy * Phy.K * this.kmul * kmuladd;

			// Attraction to pointer or touch point
			if(this.page.pointerOffset) {
				dx = this.pos.x - this.page.pointerOffset.x;
				dy = this.pos.y - this.page.pointerOffset.y;

				var l = Math.sqrt(dx * dx, dy * dy) / 100.0;
				var alpha = 1 / Math.pow((l + 1), 2);

				this.vel.x -= dx * alpha * Phy.PointerK;
				this.vel.y -= dy * alpha * Phy.PointerK;
			}

			// Friction
			var fricadd = this.page.running ? 1.0 : 0.5;
			this.vel.x *= Phy.Fric * fricadd;
			this.vel.y *= Phy.Fric * fricadd;

			this.newPos = {
				x: this.pos.x + this.vel.x,
				y: this.pos.y + this.vel.y
			};

			if(Math.abs(this.vel.x) < 0.002 && Math.abs(this.vel.y) < 0.002) {
				if(Math.abs(this.newPos.x - this.originPos.x) < 0.01 &&
					Math.abs(this.newPos.y - this.originPos.y) < 0.01) {
					this.newPos = this.originPos;
				} else {
					this.newPos = this.pos;
				}
				this.vel = {x: 0.0, y: 0.0};
				return false;
			}
			return true;
		};

		this.advance = function() {
			this.move(this.newPos.x, this.newPos.y);
		};
	}

	function findLinksByNode(links, nodeId) {
		var linkArray = [];
		for(var i = 0; i < links.length; i++) {
			if(links[i].fromNodeId == nodeId || links[i].toNodeId == nodeId)
				linkArray.push(links[i]);
		}
		return linkArray;
	}

	function Hexpage(elem) {
		this.running = false;
		this.el = $(elem);
		this.baseEl = this.el.find(".hx-base");

		var links = this.el.find(".hx-link");
		this.links = [];
		for(i = 0; i < links.length; i++) {
			this.links.push(new Link(links[i]));
		}

		var nodes = this.el.find(".hx-node");
		this.nodes = [];
		for(var i = 0; i < nodes.length; i++) {
			var newNode = new Node(nodes[i], this);
			newNode.addLinks(findLinksByNode(this.links, newNode.nodeId));
			this.nodes.push(newNode);
		}

		this.draggingNode = null;
		this.draggingOffset = {x: 0, y: 0};
		this.timer = null;
		this.touch = -1;
		this.pointerOffset = null;
		this.phy = Phy;
		this.slide = 0;

		this.update = function() {
			var sz;
			if($(window).width() > $(window).height()) {
				sz = $(window).height() * 0.95;
			} else {
				sz = $(window).width() * 0.95 * Math.sqrt(3) / 2;
			}
			this.baseEl.height(sz).width(sz);

			for(var i = 0; i < this.nodes.length; i++) {
				this.nodes[i].update();
			}
			for(i = 0; i < this.links.length; i++) {
				this.links[i].update();
			}
		};

		function findNode(nodes, nodeId) {
			for(var i = 0; i < nodes.length; i++) {
				if(nodes[i].nodeId == nodeId) return nodes[i];
			}
		}

		this.mousedown = function(e) {
			if($(e.target).hasClass("hx-block")) return;

			var nodeId = parseInt($(e.currentTarget).data("node-id"));
			var node = findNode(this.nodes, nodeId);
			if(node.nailed) return;

			var clientX, clientY;
			if(e.type === "touchstart") {
				if(this.touch >= 0) return;
				clientX = e.originalEvent.changedTouches[0].clientX;
				clientY = e.originalEvent.changedTouches[0].clientY;
				this.touch = e.originalEvent.changedTouches[0].identifier;

				var baseRect = this.baseEl[0].getBoundingClientRect();
				this.pointerOffset = {
					x: (clientX - baseRect.left) * 100 / baseRect.width,
					y: (clientY - baseRect.top) * 100 / baseRect.height
				};
			} else {
				clientX = e.clientX;
				clientY = e.clientY;
			}
			e.preventDefault();

			this.draggingNode = node;

			var rect = e.currentTarget.getBoundingClientRect();
			this.draggingOffset = {
				x: clientX - rect.left - rect.width / 2,
				y: clientY - rect.top - rect.height / 2
			};

			this.updateTimer();
		};

		this.mouseup = function(e) {
			if(e.type === "touchend" || e.type === "touchcancel") {
				if(this.touch < 0) return;
				var found = false;
				for(var i = 0; i < e.originalEvent.changedTouches.length; i++) {
					if(e.originalEvent.changedTouches[i].identifier == this.touch) {
						found = true;
						break;
					}
				}
				if(!found) return;
				this.pointerOffset = null;
			}
			
			this.draggingNode = null;
			this.touch = -1;
			this.updateTimer();
		};

		this.mousemove = function(e) {
			var clientX, clientY;
			if(e.type === "touchmove") {
				if(this.touch < 0) return;
				var found = false;
				for(var i = 0; i < e.originalEvent.changedTouches.length; i++) {
					if(e.originalEvent.changedTouches[i].identifier == this.touch) {
						clientX = e.originalEvent.changedTouches[i].clientX;
						clientY = e.originalEvent.changedTouches[i].clientY;
						found = true;
						break;
					}
				}
				if(!found) return;
			} else {
				if(!e.buttons) {
					this.draggingNode = null;
					this.touch = -1;
				}
				clientX = e.clientX;
				clientY = e.clientY;
			}
			e.preventDefault();

			var rect = this.baseEl[0].getBoundingClientRect();
			var offset = {
				x: clientX - rect.left,
				y: clientY - rect.top
			};

			this.pointerOffset = {
				x: offset.x * 100 / rect.width,
				y: offset.y * 100 / rect.height
			};

			if(this.draggingNode) {
				this.draggingNode.move((offset.x - this.draggingOffset.x) * 100/ rect.width,
					(offset.y - this.draggingOffset.y) * 100 / rect.height);
			}

			this.updateTimer();
		};

		this.mouseleave = function() {
			this.pointerOffset = null;
			this.updateTimer();
		};

		this.wheelTimeStamp = 0;
		this.scrollTimeStamp = 0;
		this.scrollBuffer = [];

		this.scroll = function(dir) {
			var step = dir === "down" ? 1 : -1;
			if(this.slide + step < 0 || this.slide + step > 3) return;
			this.slide += step;
			switch(this.slide) {
				case 0:
					this.el.find(".hx-net").addClass("collapsed");
					this.el.find(".hx-block.small").addClass("collapsed");
					this.el.find(".hx-block.big").addClass("collapsed");
					this.stop();
				break;

				case 1:
					this.el.find(".hx-net").addClass("collapsed");
					this.el.find(".hx-block.small").removeClass("collapsed");
					this.el.find(".hx-block.big").addClass("collapsed");
					this.stop();
				break;

				case 2:
					this.el.find(".hx-net").removeClass("collapsed");
					this.el.find(".hx-block.small").removeClass("collapsed");
					this.el.find(".hx-block.big").addClass("collapsed");
					this.start();
				break;

				case 3:
					this.el.find(".hx-net").removeClass("collapsed");
					this.el.find(".hx-block.small").removeClass("collapsed");
					this.el.find(".hx-block.big").removeClass("collapsed");
					this.start();
			}
		};

		function getAverage(elements, number) {
			var sum = 0;
			var num = Math.min(elements.length, number);
			for(var i = elements.length - num; i < elements.length; i++) {
				sum += elements[i];
			}
			return sum / num;
		}

		this.wheel = function(e) {
			e.preventDefault();
			var delta = e.originalEvent.deltaY;

			if(this.scrollBuffer > 149) {
				this.scrollBuffer.shift();
			}
			this.scrollBuffer.push(Math.abs(delta));

			var ts = e.timeStamp;
			if(ts - this.wheelTimeStamp > Phy.WheelTimeDelta) {
				this.scrollBuffer = [];
			}
			this.wheelTimeStamp = ts;

			if(ts - this.scrollTimeStamp > Phy.WheelTimeDelta) {
				var accel = getAverage(this.scrollBuffer, 10) >= getAverage(this.scrollBuffer, 70);
				if(accel) {
					this.scrollTimeStamp = ts;
					this.scroll(delta < 0 ? "up" : "down");
				}
			}
		};

		this.timerEvent = function() {
			var moved = false;
			for(var i = 0; i < this.nodes.length; i++) {
				moved |= this.nodes[i].calcForces();
			}
			
			for(i = 0; i < this.nodes.length; i++) {
				this.nodes[i].advance();
			}

			for(i = 0; i < this.links.length; i++) {
				this.links[i].update();
			}

			if(!moved && this.timer) {
				this.clearTimer();
			}
		};

		this.updateTimer = function() {
			if(!this.timer) this.timer = window.setInterval($.proxy(this.timerEvent, this), Phy.Interval);
		};

		this.clearTimer = function() {
			window.clearInterval(this.timer);
			this.timer = null;
		};

		this.stop = function() {
			if(!this.running) return;
			this.running = false;
			this.el.off("mousedown touchstart", ".hx-node")
				.off("mouseup touchend touchcancel")
				.off("mousemove touchmove")
				.off("mouseleave");

			this.draggingNode = null;
			this.pointerOffset = null;
			this.updateTimer();
		};

		this.start = function() {
			if(this.running) return;
			this.running = true;
			this.el.on("mousedown touchstart", ".hx-node", $.proxy(this.mousedown, this))
				.on("mouseup touchend touchcancel", $.proxy(this.mouseup, this))
				.on("mousemove touchmove", $.proxy(this.mousemove, this))
				.on("mouseleave",  $.proxy(this.mouseleave, this));
			this.update();
		};

		$(window).resize($.proxy(this.update, this));
		$(window).on("wheel", $.proxy(this.wheel, this));

		this.update();
		this.el.css("visibility", "visible");
	}

	$(document).ready(function() {
		window.hexpage = new Hexpage($(".hx-page"));
	});
})();