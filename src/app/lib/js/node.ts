import { storeAPI } from "../store";

export const updateCurrentCounter = async () => {
    const request = await fetch('https://node.xian.org/abci_query?path=%22/get/con_counter.counter%22');
    const data = await request.json();
    // @ts-ignore
    const setCounterValue = storeAPI.getState().setCounterValue;
    setCounterValue(atob(data.result.response.value));
}