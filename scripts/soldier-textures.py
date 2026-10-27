"""Original repeatable camouflage and woven PBR maps; no source asset downloads."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math
import random
import sys

out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
rnd=random.Random(21907)
size=1024
camo=Image.new('RGB',(size,size),(106,112,84));draw=ImageDraw.Draw(camo)
# Multi-scale, tile-wrapped organic camouflage silhouettes.
for scale,count in [(125,130),(42,440)]:
    for i in range(count):
        x,y=rnd.randrange(size),rnd.randrange(size)
        color=[(66,78,58),(143,133,98),(89,94,67),(47,59,45)][i%4]
        angles=sorted(rnd.random()*math.tau for _ in range(13))
        points=[(x+math.cos(a)*scale*(.25+rnd.random()*.7),y+math.sin(a)*scale*(.25+rnd.random()*.7)) for a in angles]
        for dx in [-size,0,size]:
            for dy in [-size,0,size]:draw.polygon([(px+dx,py+dy) for px,py in points],fill=color)
# Fabric weave is subtle at close range, not broad painted stripes.
pixels=camo.load()
cordura=Image.new('RGB',(size,size));cp=cordura.load()
for y in range(size):
    for x in range(size):
        weave=(((x+y)%4)-1.5)*1.2+rnd.uniform(-2.2,2.2)
        pixels[x,y]=tuple(max(0,min(255,int(v+weave))) for v in pixels[x,y])
        cp[x,y]=tuple(int(v+weave) for v in (88,98,68))
camo.save(out/'camo-albedo.jpg',quality=92,subsampling=0)
cordura.save(out/'cordura-albedo.jpg',quality=90)
charcoal=cordura.point(lambda value: round(value*.32))
charcoal.save(out/'charcoal-albedo.jpg',quality=90)
for name,value in [('camo',221),('cordura',231),('charcoal',229)]:
    rough=Image.new('L',(512,512));rp=rough.load()
    for y in range(512):
        for x in range(512):rp[x,y]=max(0,min(255,int(value+5*math.sin(x*1.57)*math.cos(y*1.57))))
    rough.save(out/f'{name}-rough.png')
normal=Image.new('RGB',(512,512));np=normal.load()
for y in range(512):
    for x in range(512):
        nx=.10*math.sin(x*math.pi/2);ny=.10*math.sin(y*math.pi/2)
        nz=math.sqrt(1-nx*nx-ny*ny)
        np[x,y]=(round((nx*.5+.5)*255),round((ny*.5+.5)*255),round((nz*.5+.5)*255))
normal.save(out/'woven-normal.png')
