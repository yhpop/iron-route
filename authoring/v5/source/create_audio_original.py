import numpy as np
from scipy.signal import butter,sosfilt
from scipy.io.wavfile import write
import os
P=os.path.dirname(os.path.abspath(__file__));sr=48000;t=np.arange(sr*30)/sr;rng=np.random.default_rng(735)
def low(x,hz):return sosfilt(butter(3,hz,fs=sr,output='sos'),x)
speed=np.interp(t,[0,18.5,19.3,20,25,26,27.5,30],[.85,.85,.4,0,0,.32,.85,.85]);phase=2*np.pi*np.cumsum(37+13*speed)/sr
engine=(.045+.025*speed)*(np.sin(phase)+.3*np.sin(phase*2)+.15*np.sin(phase*3));engine+=(.045+.035*speed)*low(rng.normal(size=len(t)),230)
trackphase=2*np.pi*np.cumsum(4+6*speed)/sr;tracks=np.maximum(0,np.sin(trackphase))**18*.065*speed*low(rng.normal(size=len(t)),3800)
a=engine+tracks+.026*low(rng.normal(size=len(t)),750)
for onset,amp,duration in [(20.02,.72,1.6),(21.21,1,4)]:
 q=t-onset;env=np.where(q>=0,np.exp(-np.maximum(q,0)/(duration/5)),0);crack=low(rng.normal(size=len(t)),5000)*np.exp(-np.maximum(q,0)*38);boom=np.sin(2*np.pi*(52*np.maximum(q,0)-4*np.maximum(q,0)**2))*np.exp(-np.maximum(q,0)*4);a+=amp*env*(crack*.4+boom*.25+low(rng.normal(size=len(t)),550)*.75*.65)
for onset in [21.9,22.14,22.65,23.1,23.7]:q=t-onset;env=np.where(q>=0,np.exp(-np.maximum(q,0)*18),0);a+=env*.055*low(rng.normal(size=len(t)),1800)
a+=np.clip((t-22)/1.5,0,1)*.009*(rng.normal(size=len(t))-low(rng.normal(size=len(t)),5000));fade=np.minimum(1,t/.65)*np.minimum(1,(30-t)/.7);a=np.tanh(a*1.2)*fade
write(P+'/Tank_City_Final_Soundtrack.wav',sr,(np.column_stack([a,np.roll(a,14)*.98])*28500).astype(np.int16));print('AUDIO_REBUILT_30_SECONDS')
