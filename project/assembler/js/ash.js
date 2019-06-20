var fs = require("fs");
var c  = console;
var file = process.argv[2];

var dtable = {
  ""   :0b000,
  "M"  :0b001,
  "D"  :0b010,
  "MD" :0b011,
  "A"  :0b100,
  "AM" :0b101,
  "AD" :0b110,
  "AMD":0b111
}
//建立dest 其中的0b000是js以2進位表達的00
var jtable = {
  ""   :0b000,
  "JGT":0b001,
  "JEQ":0b010,
  "JGE":0b011,
  "JLT":0b100,
  "JNE":0b101,
  "JLE":0b110,
  "JMP":0b111
}
//建立jump
var ctable = {
  "0"   :0b0101010,
  "1"   :0b0111111,
  "-1"  :0b0111010,
  "D"   :0b0001100,
  "A"   :0b0110000, 
  "M"   :0b1110000,
  "!D"  :0b0001101,
  "!A"  :0b0110001, 
  "!M"  :0b1110001,
  "-D"  :0b0001111,
  "-A"  :0b0110011,
  "-M"  :0b1110011,
  "D+1" :0b0011111,
  "A+1" :0b0110111,
  "M+1" :0b1110111,
  "D-1" :0b0001110,
  "A-1" :0b0110010,
  "M-1" :0b1110010,
  "D+A" :0b0000010,
  "D+M" :0b1000010,
  "D-A" :0b0010011,
  "D-M" :0b1010011,
  "A-D" :0b0000111,
  "M-D" :0b1000111,
  "D&A" :0b0000000,
  "D&M" :0b1000000,
  "D|A" :0b0010101,
  "D|M" :0b1010101
}
//建立comp,後面的7碼前面的0=A,1=M
var symTable = {
  "R0"  :0,
  "R1"  :1,
  "R2"  :2,
  "R3"  :3,
  "R4"  :4,
  "R5"  :5,
  "R6"  :6,
  "R7"  :7,
  "R8"  :8,
  "R9"  :9,
  "R10" :10,
  "R11" :11,
  "R12" :12,
  "R13" :13,
  "R14" :14,
  "R15" :15,
  "SP"  :0,
  "LCL" :1,
  "ARG" :2,
  "THIS":3, 
  "THAT":4,
  "KBD" :24576,
  "SCREEN":16384
};
//R0~R15是預設的;SP~THAT為虛擬機的緞帶碼;KBD固定的24576;SCREEN為16384,16384~24576都可使用
var symTop = 16;
//放符號表
function addSymbol(symbol) {
  symTable[symbol] = symTop;
  symTop ++;
}
//設一個可以放符號的位置,且不會重複放
assemble(file+'.asm', file+'.hack');
//呼叫組譯器[輸入.asm檔,輸出.hack檔]
function assemble(asmFile, objFile) {
  var asmText = fs.readFileSync(asmFile, "utf8"); // 讀取檔案到 text 字串中
  var lines   = asmText.split(/\r?\n/); // 將組合語言分割成一行一行(正規表達式)
  c.log(JSON.stringify(lines, null, 2));    //印出
  pass1(lines);         //記住所有符號的位置
  pass2(lines, objFile);         //編碼
} 

function parse(line, i) {
  line.match(/^([^\/]*)(\/.*)?$/);
  line = RegExp.$1.trim();   //$1代表第一個參數,trim();把左右空白的部分消去
  if (line.length===0)
    return null;
  if (line.startsWith("@")) {
    return { type:"A", arg:line.substring(1).trim() }
  } else if (line.match(/^\(([^\)]+)\)$/)) {
    return { type:"S", symbol:RegExp.$1 }
  } else if (line.match(/^((([AMD]*)=)?([AMD01\+\-\&\|\!]*))(;(\w*))?$/)) { //([AMD]*)代表ADM組合
    return { type:"C", c:RegExp.$4, d:RegExp.$3, j:RegExp.$6 }
  } else {
    throw "Error: line "+(i+1);
  }
}
//([AMD]*) d欄位;([AMD01\+\-\&\|\!]*)) c指令;(\w*))?$/)) j欄位
function pass1(lines) {
  c.log("============== pass1 ================");
  var address = 0;
  for (var i=0; i<lines.length; i++) {
    var p = parse(lines[i], i);   //解析指令
    if (p===null) continue;     //null(空行or註解)
    if (p.type === "S") {
      c.log(" symbol: %s %s", p.symbol, intToStr(address, 4, 10));
      symTable[p.symbol] = address;   //加到符號表記住它的位置
      continue;     //設定continue 辨別如果是符號的話,回到前面的continue
    } else {
      c.log(" p: %j", p);    //印出結果
    }
    c.log("%s:%s %s", intToStr(i+1, 3, 10), intToStr(address, 4, 10),  lines[i]);
    address++;
  }
}
//第2輪處理A跟C指令
function pass2(lines, objFile) {
  c.log("============== pass2 ================");
  var ws = fs.createWriteStream(objFile);  //objfile為開輸出檔
  ws.once('open', function(fd) {
    var address = 0;    //設address=0
    for (var i=0; i<lines.length; i++) {
      var p = parse(lines[i], i);
      if (p===null || p.type === "S") continue;   //如果是空行&符號
      var code = toCode(p);    //判斷指令為A or C
      c.log("%s:%s %s", intToStr(i+1, 3, 10), intToStr(code, 16, 2),  lines[i]);  //i+1指從第0個開始;3是指轉出3個數字;10指的是以10進位表示;code是指傳回的指令為數字再轉成字串(輸出要2進位的字串);16=字串長度;2=2進位
      ws.write(intToStr(code, 16, 2)+"\n");
      address++;
    }
    ws.end();
  });
}
//整數轉字串
function intToStr(num, size, radix) {
//  c.log(" num="+num);
  var s = num.toString(radix)+"";
  while (s.length < size) s = "0" + s;
  return s;
}

function toCode(p) {
  var address; 
  if (p.type === "A") {
    if (p.arg.match(/^\d+$/)) {
      address = parseInt(p.arg);  //如果是A指令 把字串轉成數字
    } else {
      address = symTable[p.arg];  //不是數字(@, @Loop ...)
      if (typeof address === 'undefined') {
        address = symTop;
        addSymbol(p.arg, address);    //處理像是counter的符號    
      }
    }
    return address; 
  } else { // if (p.type === "C")   //處理C指令
    var d = dtable[p.d];
    var cx = ctable[p.c];
    var j = jtable[p.j];
    return 0b111<<13|cx<<6|d<<3|j;
  }
}
