import os,signal,subprocess,sys,time
child=subprocess.Popen([sys.executable,'-c','import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(30)'])
print('descendant',child.pid,flush=True)
time.sleep(.05)
# Leader exits early; descendant remains in the group beyond timeout.
sys.exit(0)
