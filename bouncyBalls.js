function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

class Ball
{
    constructor(x, y, velocity, radius, color)
    {
        this.position = createVector(x, y);
        
        this.radius = radius;
        
        this.color = color;
        
        this.velocity = velocity;
        
        this.uuid = uuidv4();
    }
    
    intersects(x, y, r) {
        return Math.hypot(this.position.x - x, this.position.y - y) <= this.radius/2 + r;
    }
    
    move()
    {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }
    
    render()
    {
        fill(this.color);
        circle(this.position.x, this.position.y, this.radius);
    }
}

class bouncyBallHandler
{
    constructor(width, height)
    {
        this.width = width;
        this.height = height;
        
        this.balls = [];
        
        this.quadtree = new Quadtree({
        	x: 0,
        	y: 0,
        	width: this.width,
        	height: this.height,
        });
    } 
    
    addBall(ball)
    {
        this.balls.push(ball);
    }
    
    getQuadtreeObject(index)
    {
        
        let ball = this.balls[index];
        
        var myObject = {
        	x: ball.position.x,
        	y: ball.position.y,
        	width: ball.radius,
        	height: ball.radius,
        	radius: ball.radius,
        	index: index,
        	uuid: ball.uuid
        }
        
        return myObject;
    }
    
    updateQuadtreePosition(index)
    {
        this.quadtree.insert(this.getQuadtreeObject(index));
    }
    
    getQuadtreeCandidates(index)
    {
        return this.quadtree.retrieve(this.getQuadtreeObject(index));
    }
    
    resolveCollision(ballA, ballB) {
    	var relVel = [ballB.velocity.x - ballA.velocity.x, ballB.velocity.y - ballA.velocity.y];
    	var norm = [ballB.position.x - ballA.position.x, ballB.position.y - ballA.position.y];
    	var mag = Math.sqrt(norm[0]*norm[0] + norm[1]*norm[1]);
    	norm = [norm[0]/mag,norm[1]/mag];
    	
    	var velAlongNorm = relVel[0]*norm[0] + relVel[1]*norm[1];
    	if(velAlongNorm > 0)
    		return;
    	
    	var bounce = 0.7;
    	var j = -(1 + bounce) * velAlongNorm;
    	j /= 1/ballA.radius + 1/ballB.radius;
    	
    	var impulse = [j*norm[0],j*norm[1]];
    	
    	ballA.velocity.x -= 1/ballA.radius * impulse[0];
    	ballA.velocity.y -= 1/ballA.radius * impulse[1];
    	ballB.velocity.x += 1/ballB.radius * impulse[0];
    	ballB.velocity.y += 1/ballB.radius * impulse[1];
    }
    
    adjustPositions(ballA,ballB,depth) { //Inefficient implementation for now
    	const percent = 0.2;
    	const slop = 0.01;
    	
    	var corr = (Math.max(depth - slop, 0) / (1/ballA.radius + 1/ballB.radius)) * percent;
    	
    	var norm = [ballB.position.x - ballA.position.x, ballB.position.y - ballA.position.y];
    	var mag = Math.sqrt(norm[0]*norm[0] + norm[1]*norm[1]);
    	norm = [norm[0]/mag,norm[1]/mag];
    	let correction = [corr*norm[0],corr*norm[1]];
    	
    	ballA.position.x -= (1/ballA.radius * correction[0])/2;
    	ballA.position.y -= (1/ballA.radius * correction[1])/2;
    	ballB.position.x += (1/ballB.radius * correction[0])/2;
    	ballB.position.y += (1/ballB.radius * correction[1])/2;
    }
    
    
    handleCollision(ball, candidates)
    {
        
        for(let candidateIndex=0;candidateIndex<candidates.length;candidateIndex++) {

            var candidate = candidates[candidateIndex];

            if(ball.uuid == candidate.uuid) continue;

            let intersect = ball.intersects(candidate.x, candidate.y, candidate.radius/2);
            
            //console.log(ball, candidate)
            
            if(intersect) {
                
                let dx = candidate.x - ball.position.x;
                let dy = candidate.y - ball.position.y;
                
                this.adjustPositions(ball, this.balls[candidate.index], Math.sqrt(dx*dx+dy*dy))
                this.resolveCollision(ball, this.balls[candidate.index]);
            }
            
        }
        
    }
    
    update()
    {
        this.quadtree.clear();
        
        for(let ballIndex=0;ballIndex<this.balls.length;ballIndex++)
        {
            let ball = this.balls[ballIndex];
            
            ball.move();
            
            ball.color = hsl2rgb((ball.position.x+ball.position.y)/2, 1, 0.5);
            
            ball.render();
            
            this.updateQuadtreePosition(ballIndex);
        }
        
        for(let ballIndex=0;ballIndex<this.balls.length;ballIndex++)
        {
            let ball = this.balls[ballIndex];
            
            let candidates = this.getQuadtreeCandidates(ballIndex);
            
            this.handleCollision(ball, candidates);
            
            if (ball.radius + ball.position.x > this.width)
                ball.velocity.x = 0 - ball.velocity.x;
     
            if (ball.position.x - ball.radius < 0)
                ball.velocity.x = 0 - ball.velocity.x;
     
            if (ball.position.y + ball.radius > this.height)
                ball.velocity.y = 0 - ball.velocity.y;
     
            if (ball.position.y - ball.radius < 0)
                ball.velocity.y = 0 - ball.velocity.y;
        }
    }
}

function hsl2rgb(h,s,l) 
{
   let a=s*Math.min(l,1-l);
   let f= (n,k=(n+h/30)%12) => l - a*Math.max(Math.min(k-3,9-k,1),-1);
   return [f(0)*255,f(8)*255,f(4)*255];
}

function windowResized(){
  width=windowWidth//screen.width-10;
  height=windowHeight//screen.height-10;
  resizeCanvas(width, height);
}

function setup() {
  width=windowWidth//screen.width-10;
  height=windowHeight//screen.height-10;
    
  var cnv = createCanvas(width, height);
  var centerX = (windowWidth - width) / 2;
  var centerY = (windowHeight - height) / 2;
  cnv.position(centerX, centerY);
  cnv.style('display', 'block');
  
  spawnSpeed = getItem('spawnSpeed') ?? 2;
  spawnAmount = getItem('spawnAmount') ?? 1;
  
  ballHandler = new bouncyBallHandler(width, height);
  
  noStroke();
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnBallAtCursor(amount=1)
{
    for(amountX=0;amountX<amount;amountX++)
    {
        let radius = getRandomArbitrary(4, 7);
           
        ball = new Ball(mouseX, mouseY, p5.Vector.random2D().mult(spawnSpeed), radius, hsl2rgb((mouseX+mouseY)/2, 1, 0.5));
          
        ballHandler.addBall(ball);
    }
}

document.addEventListener("keydown", onDocumentKeyDown, true); 
document.addEventListener("keyup", onDocumentKeyUp, true); 
function onDocumentKeyDown(event){ 
    var keyCode = event.keyCode;
    
    if(keyCode==82)
    {
        ballHandler = new bouncyBallHandler(width, height);
    }
    
    if(keyCode==38) 
    {
        spawnAmount=Math.min(100, spawnAmount+1);
    }
    if(keyCode==40) 
    {
        spawnAmount=Math.round(Math.max(1, spawnAmount-1));
    }
    if(keyCode==39) 
    {
        if(spawnSpeed < 1)
        {
            spawnSpeed=Math.round((spawnSpeed+0.1)*10)/10;
        } else 
        {
            spawnSpeed=Math.min(20, spawnSpeed+1);
        }
    }
    if(keyCode==37) 
    {
        if(spawnSpeed<=1)
        {
            spawnSpeed=Math.round(Math.max(0, spawnSpeed-0.1)*10)/10;
        } else 
        {
            spawnSpeed=Math.round(Math.max(1, spawnSpeed-1));
        }
    }
}

function onDocumentKeyUp(event){
    var keyCode = event.keyCode;
    
    if(keyCode==82) bouncyBalls=[];
    
    if(keyCode==38) storeItem('spawnAmount', spawnAmount);
    if(keyCode==40) storeItem('spawnAmount', spawnAmount);
    if(keyCode==39) storeItem('spawnSpeed', spawnSpeed);
    if(keyCode==37) storeItem('spawnSpeed', spawnSpeed);
}

var mouseDown = false;

function touchStarted() { 
    mouseDown = true;
}

function touchEnded(){ //document.body.onmouseup = function()
    mouseDown = false;
}

function draw() {
  background(100);
  
  ballHandler.update();
  
  if(mouseDown)
  {
      spawnBallAtCursor(spawnAmount);
  }
  
  fill('black')
  text("FPS: " + frameRate().toFixed(2), 10, height - 10);
  text("BALLS: " + ballHandler.balls.length, 110, height - 10);
  text("SPEED: " + spawnSpeed, 210, height - 10);
  text("BPC: " + spawnAmount, 310, height - 10);
}
