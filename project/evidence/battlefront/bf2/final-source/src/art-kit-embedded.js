import warehouse from '../assets/art-kit/warehouse-sawtooth.glb';
import pump from '../assets/art-kit/pump-station.glb';
import workshop from '../assets/art-kit/service-workshop.glb';
import truck from '../assets/art-kit/cargo-truck.glb';
import sentry from '../assets/art-kit/sentry-turret.glb';
import {loadCampaignArt} from './art-kit.js';
export function loadEmbeddedCampaignArt(){return loadCampaignArt({'warehouse-sawtooth':warehouse,'pump-station':pump,'service-workshop':workshop,'cargo-truck':truck,'sentry-turret':sentry});}
