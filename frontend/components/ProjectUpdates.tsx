"use client";
import FulfillmentProgress from "./FulfillmentProgress";
export default function ProjectUpdates({campaignId}: {campaignId: number}) {return <div id="updates" className="section-space"><FulfillmentProgress campaignId={campaignId} /></div>;}
