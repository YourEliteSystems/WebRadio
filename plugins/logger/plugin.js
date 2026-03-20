module.exports = {

  init(){
    console.log("Logger Plugin aktiv");
  },

  onMetadata(meta){
    console.log("Song:", meta.StreamTitle);
  },

  onStationChange(station){
    console.log("Sender gewechselt:", station);
  }

};