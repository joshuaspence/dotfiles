Config { font = "-*-Fixed-Bold-R-Normal-*-13-*-*-*-*-*-*-*"
       , bgColor = "black"
       , fgColor = "white"
       , position = Top
       , lowerOnStart = True
       , commands = [ Run Network "eth0"  ["-L","0","-H","1024","--normal","green","--high","red"] 10
                    , Run Network "wlan0" ["-L","0","-H","1024","--normal","green","--high","red"] 10
                    , Run Cpu ["-L","3","-H","50","--normal","green","--high","red"] 10
                    , Run Memory ["-t","Mem: <usedratio>%"] 10
                    , Run Swap [] 10
                    , Run Date "%a %b %_d %Y %H:%M:%S" "date" 10
			        , Run Battery ["-L","25","-H","75","--high","green","--normal","yellow", "--low", "red"] 10
			        , Run StdinReader
                    ]
       , sepChar = "%"
       , alignSep = "}{"
       , template = "%StdinReader% }{ %cpu% | %memory% * %swap% | %eth0% - %wlan0% }{ <fc=#ee9a00>%date%</fc>| %EGPF% | %uname%"
       }
