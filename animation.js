(function() {
	function Link(elem) {
		this.el = $(elem);
		
		this.fromNode = this.el.data("from-node");
		this.toNode = this.el.data("to-node");

		this.parentEl = this.el.closest(".hexpage-baserect");
		this.fromEl = this.parentEl.find(".hexpage-node[data-node-id='" + this.fromNode + "']");
		this.toEl = this.parentEl.find(".hexpage-node[data-node-id='" + this.toNode + "']");

		this.getCoordinates = function() {
			return {
				x0: this.fromEl.data("left"),
				y0: this.fromEl.data("top"),
				x1: this.toEl.data("left"),
				y1: this.toEl.data("top")
			};
		}

		this.move = function(x0, y0, x1, y1) {
			var dx = x1 - x0;
			var dy = y1 - y0;
			var len = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
			var phi = Math.atan2(dy, dx);
			var w = this.parentEl.width();
			var h = this.parentEl.height();
			this.len = len;

			this.el.css("transform-origin", "0 50%");
			this.el.css("transform", "translateY(-50%) translate(" + w * x0 / 100.0 + "px," + h * y0 / 100.0 + "px)" +
				"rotate(" + phi + "rad) scaleX(" + w * len / 100.0 + ")");
		};

		this.update = function() {
			var c = this.getCoordinates();
			this.move(c.x0, c.y0, c.x1, c.y1);
		};

		var c = this.getCoordinates();
		this.initialLen = Math.sqrt(Math.pow(c.x1 - c.x0, 2) + Math.pow(c.y1 - c.y0, 2));
		this.len = this.initialLen;
	};

	function Node(elem) {
		this.el = $(elem);
		this.parentEl = this.el.closest(".hexpage-baserect");
		this.nodeId = this.el.data("node-id");
		this.originX = this.el.data("left");
		this.originY = this.el.data("top");

		this.links = [];

		this.update = function() {
			var x = this.el.data("left");
			var y = this.el.data("top");
			var w = this.parentEl.width();
			var h = this.parentEl.height();

			this.el.css("transform", "translate(-50%, -50%) " +
				"translate(" + w * x / 100.0 + "px," + h * y / 100.0 + "px) rotate(0.001deg)");
		};

		this.move = function(x, y) {
			this.el.data("left", x);
			this.el.data("top", y);
			this.update();

			for(var i = 0; i < this.links.length; i++) {
				this.links[i].update();
			}
		};

		this.addLinks = function(links) {
			this.links = this.links.concat(links);
		};

		this.advance = function() {
			// All physics here
		}
	};

	function findLinksByNode(links, nodeId) {
		var linkArray = [];
		for(var i = 0; i < links.length; i++) {
			if(links[i].fromNode == nodeId || links[i].toNode == nodeId)
				linkArray.push(links[i]);
		}
		return linkArray;
	}

	function Hexpage(elem) {
		this.el = $(elem);
		this.baseEl = this.el.find(".hexpage-baserect");

		var links = this.el.find(".hexpage-link");
		this.links = [];
		for(i = 0; i < links.length; i++) {
			this.links.push(new Link(links[i]));
		}

		var nodes = this.el.find(".hexpage-node");
		this.nodes = [];
		for(var i = 0; i < nodes.length; i++) {
			var newNode = new Node(nodes[i]);
			newNode.addLinks(findLinksByNode(this.links, newNode.nodeId));
			this.nodes.push(newNode);
		}

		this.draggingNode = null;
		this.draggingOffset = {x:0, y:0};

		this.update = function() {
			var sz = Math.min($(window).height(), $(window).width()) * 0.95;
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
		};

		this.mousedown = function(e) {
			e.preventDefault();
			if($(e.target).hasClass("hexagon-outer")) return;

			var nodeId = $(e.currentTarget).data("node-id");
			var node = findNode(this.nodes, nodeId);

			this.draggingNode = node;

        	var rect = e.currentTarget.getBoundingClientRect();
        	this.draggingOffset = {
        		x: e.clientX - rect.left - rect.width / 2,
        		y: e.clientY - rect.top - rect.height / 2
        	};
		};

		this.mouseup = function() {
			this.draggingNode = null;
		};

		this.mousemove = function(e) {
			if(!this.draggingNode) return;

			var rect = this.baseEl[0].getBoundingClientRect();
        	var offset = {
        		x: e.clientX - rect.left,
        		y: e.clientY - rect.top
        	};

        	this.draggingNode.move((offset.x - this.draggingOffset.x) * 100/ rect.width,
        		(offset.y - this.draggingOffset.y) * 100 / rect.height);
		};

		$(window).resize($.proxy(this.update, this));
		this.el.on("mousedown", ".hexpage-node", $.proxy(this.mousedown, this));
		this.el.on("mouseup", ".hexpage-node", $.proxy(this.mouseup, this));
		this.el.on("mousemove", $.proxy(this.mousemove, this));

		this.update();
		this.el.css("visibility", "visible");
	};

	$(document).ready(function() {
		window.hexpage = new Hexpage($(".hexpage"));
	});
})();