import test from 'node:test';import assert from 'node:assert/strict';
import {boot,action} from './main-entry-harness.mjs';
test('actual main consumes order on fixed tick, pause discards queued order, retry resets command',async t=>{
 const app=await boot('?sortie=ridge-convoy');t.after(()=>app.dispose());action(app,'start').dispatch('click');
 // Setup this integration test past route choice; route traversal is tested by the CPU tape.
 app.latest.state.selectedConvoyChoiceId='covered';app.frame();
 app.uiActions.orderConvoy('hold');assert.equal(app.latest.state.convoyOrder,'advance');
 for(let i=0;i<3;i++)app.frame();assert.equal(app.latest.state.convoyOrder,'hold');
 app.uiActions.orderConvoy('advance');action(app,'pause').dispatch('click');action(app,'resume').dispatch('click');
 for(let i=0;i<3;i++)app.frame();assert.equal(app.latest.state.convoyOrder,'hold');
 app.uiActions.orderConvoy('advance');for(let i=0;i<3;i++)app.frame();assert.equal(app.latest.state.convoyOrder,'advance');
 app.uiActions.orderConvoy('hold');action(app,'pause').dispatch('click');action(app,'retry').dispatch('click');
 assert.equal(app.latest.state.convoyOrder,'advance');assert.equal(app.latest.state.selectedConvoyChoiceId,null);
});
