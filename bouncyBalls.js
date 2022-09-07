function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

class Ball {
  constructor(x, y, velocity, radius, color, lifetime = 100) {
    this.position = new Vector(x, y);

    this.radius = radius;

    this.color = color;

    this.velocity = velocity;

    this.uuid = uuidv4();

    this.initialLifetime = lifetime;
    this.lifetime = this.initialLifetime;
  }

  intersects(x, y, r) {
    return (
      Math.hypot(this.position.x - x, this.position.y - y) <=
      this.radius / 2 + r
    );
  }

  move(delta) {
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
  }

  render(ctx) {
    //fill(this.color);
    //circle(this.position.x, this.position.y, this.radius);

    ctx.shadowBlur = 20;

    ctx.shadowColor = `rgb(${this.color[0]},${this.color[1]},${this.color[2]}`;

    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius / 2, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(${this.color[0]},${this.color[1]},${this.color[2]},${
      this.lifetime / this.initialLifetime //if it is equal to or more than 100 it will be fully transparent
    })`;
    ctx.fill();
  }
}

class bouncyBallHandler {
  constructor(width, height, ctx, frameRetrieve = 0) {
    this.width = width;
    this.height = height;

    this.ctx = ctx;

    this.balls = [];

    this.quadtree = new Quadtree({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    });

    this.lifedrain = 1.5;

    this.frame = 0;
    this.frameRetrieve = frameRetrieve;

    this.firstFrame = true;

    this.candidates = [];

    this.newBall = false;
  }

  addBall(ball) {
    this.newBall = true;
    this.balls.push(ball);

    ball.index = this.balls.length - 1;

    return ball;
  }

  removeBall(index) {
    //const ref = this.balls[index];
    this.balls.splice(index, 1);

    //delete ref; //return ball;
  }

  getQuadtreeObject(index) {
    let ball = this.balls[index];

    var myObject = {
      x: ball.position.x,
      y: ball.position.y,
      width: ball.radius,
      height: ball.radius,
      radius: ball.radius,
      index: index,
      uuid: ball.uuid,
    };

    return myObject;
  }

  updateQuadtreePosition(index) {
    this.quadtree.insert(this.getQuadtreeObject(index));
  }

  getQuadtreeCandidates(index) {
    return this.quadtree.retrieve(this.getQuadtreeObject(index));
  }

  resolveCollision(ballA, ballB) {
    var relVel = [
      ballB.velocity.x - ballA.velocity.x,
      ballB.velocity.y - ballA.velocity.y,
    ];
    var norm = [
      ballB.position.x - ballA.position.x,
      ballB.position.y - ballA.position.y,
    ];
    var mag = Math.sqrt(norm[0] * norm[0] + norm[1] * norm[1]);
    norm = [norm[0] / mag, norm[1] / mag];

    var velAlongNorm = relVel[0] * norm[0] + relVel[1] * norm[1];
    if (velAlongNorm > 0) return;

    var bounce = 0.7;
    var j = -(1 + bounce) * velAlongNorm;
    j /= 1 / ballA.radius + 1 / ballB.radius;

    var impulse = [j * norm[0], j * norm[1]];

    ballA.velocity.x -= (1 / ballA.radius) * impulse[0];
    ballA.velocity.y -= (1 / ballA.radius) * impulse[1];
    ballB.velocity.x += (1 / ballB.radius) * impulse[0];
    ballB.velocity.y += (1 / ballB.radius) * impulse[1];
  }

  adjustPositions(ballA, ballB, depth) {
    //Inefficient implementation for now
    const percent = 0.2;
    const slop = 0.01;

    var corr =
      (Math.max(depth - slop, 0) / (1 / ballA.radius + 1 / ballB.radius)) *
      percent;

    var norm = [
      ballB.position.x - ballA.position.x,
      ballB.position.y - ballA.position.y,
    ];
    var mag = Math.sqrt(norm[0] * norm[0] + norm[1] * norm[1]);
    norm = [norm[0] / mag, norm[1] / mag];
    let correction = [corr * norm[0], corr * norm[1]];

    ballA.position.x -= ((1 / ballA.radius) * correction[0]) / 2;
    ballA.position.y -= ((1 / ballA.radius) * correction[1]) / 2;
    ballB.position.x += ((1 / ballB.radius) * correction[0]) / 2;
    ballB.position.y += ((1 / ballB.radius) * correction[1]) / 2;
  }

  handleCollision(ball, candidates) {
    //if(candidates.length<=1) console.log(candidates)

    for (
      let candidateIndex = 0;
      candidateIndex < candidates.length;
      candidateIndex++
    ) {
      var candidate = candidates[candidateIndex];

      if (ball.uuid == candidate.uuid) continue;

      let intersect = ball.intersects(
        candidate.x,
        candidate.y,
        candidate.radius / 2
      );

      //console.log(ball, candidate)

      if (intersect) {
        let dx = candidate.x - ball.position.x;
        let dy = candidate.y - ball.position.y;

        this.adjustPositions(
          ball,
          this.balls[candidate.index],
          Math.sqrt(dx * dx + dy * dy)
        );
        this.resolveCollision(ball, this.balls[candidate.index]);
      }
    }
  }

  update(delta, overrideUpdate) {
    if (this.balls.length === 0) return;

    this.frameRetrieve = delta * 100;

    this.quadtree.clear();

    for (let ballIndex = 0; ballIndex < this.balls.length; ballIndex++) {
      let ball = this.balls[ballIndex];

      ball.move(delta);

      ball.lifetime -= this.lifedrain - delta;
      ball.color = hsl2rgb((ball.position.x + ball.position.y) / 2, 1, 0.5);

      if (ball.lifetime <= 0) {
        this.removeBall(ballIndex);
        continue;
      }
      if (this.balls.length === 0) return;

      //console.log(JSON.parse(JSON.stringify(this.balls)));

      ball.render(this.ctx);

      this.updateQuadtreePosition(ballIndex);
    }

    for (let ballIndex = 0; ballIndex < this.balls.length; ballIndex++) {
      let ball = this.balls[ballIndex];

      if (
        (this.frame >= this.frameRetrieve ||
          this.firstFrame === true ||
          this.newBall === true) &&
        delta > 0.08
      ) {
        //
        this.candidates[ballIndex] = this.getQuadtreeCandidates(ballIndex);

        this.frame = 0;
      } else {
        this.candidates[ballIndex] = this.getQuadtreeCandidates(ballIndex);
      }

      //console.log(typeof this.candidates[ballIndex], this.newBall);
      //f
      this.handleCollision(ball, this.candidates[ballIndex]);

      if (ball.radius + ball.position.x > this.width)
        ball.velocity.x = 0 - ball.velocity.x;

      if (ball.position.x - ball.radius < 0)
        ball.velocity.x = 0 - ball.velocity.x;

      if (ball.position.y + ball.radius > this.height)
        ball.velocity.y = 0 - ball.velocity.y;

      if (ball.position.y - ball.radius < 0)
        ball.velocity.y = 0 - ball.velocity.y;
    }

    //if (this.firstFrame || this.newBall) console.log("?", this.frameRetrieve);

    this.frame++;

    this.firstFrame = false;
    this.newBall = false;
  }
}

function hsl2rgb(h, s, l) {
  let a = s * Math.min(l, 1 - l);
  let f = (n, k = (n + h / 30) % 12) =>
    l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

function randomVector() {
  rangrad = 2 * Math.PI * Math.random();

  return new Vector(Math.cos(rangrad), Math.sin(rangrad));
}

var minSpawnSpeed = 20;
var maxSpawnSpeed = 500;

var lifetimeMultiplier = 10;

function spawnBallAtCursor(amount = 1, minRadius, maxRadius) {
  for (amountX = 0; amountX < amount; amountX++) {
    let radius = getRandomArbitrary(minRadius, maxRadius);

    var angle = Math.random() * Math.PI * 2;
    const x = mouseX + Math.cos(angle) * spawnRadius;
    const y = mouseY + Math.sin(angle) * spawnRadius;

    let velocity = randomVector();

    let speed = getRandomArbitrary(minSpawnSpeed, maxSpawnSpeed);

    velocity.x *= speed;
    velocity.y *= speed;

    ball = new Ball(
      x,
      y,
      velocity,
      radius,
      hsl2rgb((mouseX + mouseY) / 2, 1, 0.5),
      radius * lifetimeMultiplier
    );

    ballHandler.addBall(ball);

    ball.render(ctx);
  }
}

// document.addEventListener("keydown", onDocumentKeyDown, true);
// document.addEventListener("keyup", onDocumentKeyUp, true);

// var time = true;
// function onDocumentKeyDown(event) {
//   var keyCode = event.keyCode;

//   if (keyCode == 32) {
//     time = !time;
//   }

//   if (keyCode == 82) {
//     ballHandler = new bouncyBallHandler(canvas.width, canvas.height, ctx, 5);
//   }

//   if (keyCode == 38) {
//     spawnAmount = Math.min(100, spawnAmount + 1);
//   }
//   if (keyCode == 40) {
//     spawnAmount = Math.round(Math.max(1, spawnAmount - 1));
//   }
//   if (keyCode == 39) {
//     if (spawnSpeed < 1) {
//       spawnSpeed = Math.round((spawnSpeed + 0.1) * 10) / 10;
//     } else {
//       spawnSpeed = Math.min(100, spawnSpeed + 1);
//     }
//   }
//   if (keyCode == 37) {
//     if (spawnSpeed <= 1) {
//       spawnSpeed = Math.round(Math.max(0, spawnSpeed - 0.1) * 10) / 10;
//     } else {
//       spawnSpeed = Math.round(Math.max(1, spawnSpeed - 1));
//     }
//   }
// }

// function onDocumentKeyUp(event) {
//   var keyCode = event.keyCode;

//   if (keyCode == 82) bouncyBalls = [];

//   if (keyCode == 38 || keyCode == 40)
//     window.localStorage.setItem("spawnAmount", spawnAmount); //storeItem('spawnAmount', spawnAmount);

//   if (keyCode == 39 || keyCode == 37)
//     window.localStorage.setItem("spawnSpeed", spawnSpeed); //storeItem('spawnSpeed', spawnSpeed);
// }

const maxRadius = 20;
const minRadius = 2;

var mouseMoving = true;

// document.body.onmousedown = function () {
//   mouseDown = true;
// };

// document.body.onmouseup = function () {
//   //document.body.onmouseup = function()
//   mouseDown = false;
// };

onmousemove = function (e) {
  mouseMoving = true;
  mouseX = e.clientX;
  mouseY = e.clientY;

  // const diffX = Math.abs(mouseX - lastMouseX);
  // const diffY = Math.abs(mouseY - lastMouseY);

  // const diff = (diffX + diffY) / 200;

  spawnBallAtCursor(spawnAmount, minRadius, maxRadius);
};

var canvas = document.getElementById("canvas");

canvas.offscreenCanvas = document.createElement("canvas");
canvas.offscreenCanvas.width = canvas.width;
canvas.offscreenCanvas.height = canvas.height;

//ctx2 = canvas.offscreenCanvas.getContext("2d");

// console.log(ctx2);

canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
var ctx = canvas.getContext("2d");

//ctx.filter = "blur(10px)";

ballHandler = new bouncyBallHandler(canvas.width, canvas.height, ctx, 1);

var mouseX = 0;
var mouseY = 0;

var lastMouseX = 0;
var lastMouseY = 0;

var spawnSpeed = 50;
var spawnAmount = 5;

var spawnRadius = 1;

ctx.font = "15px Arial";

var lastCalledTime = 1;
var fps = 0;

ballHandler.addBall(new Ball(100, 100, new Vector(4, 4), 10, [255, 255, 255]));
//console.log(fps);
function draw() {
  if (!lastCalledTime) {
    lastCalledTime = Date.now();
    fps = 0;
    return;
  }
  delta = (Date.now() - lastCalledTime) / 1000;
  lastCalledTime = Date.now();
  fps = 1 / delta;

  // if (mouseMoving) {
  //   spawnBallAtCursor(spawnAmount, minRadius, maxRadius);
  // }

  //if (!time) return requestAnimationFrame(draw);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ballHandler.update(Math.min(2, delta), false);

  // ctx.fillStyle = `black`;
  // ctx.fillText("FPS: " + fps.toFixed(2), 10, canvas.height - 10);
  // ctx.fillText("BALLS: " + ballHandler.balls.length, 110, canvas.height - 10);
  // ctx.fillText("SPEED: " + spawnSpeed, 210, canvas.height - 10);
  // ctx.fillText("BPC: " + spawnAmount, 310, canvas.height - 10);
  // ctx.fillText("DELTA: " + delta, 410, canvas.height - 10);

  requestAnimationFrame(draw);
}

draw();
