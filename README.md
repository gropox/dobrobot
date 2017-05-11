# Добробот

Добробот - автомат, который ведет ваш баланс доброты на голосе, 
следует за вами куда бы вы не пошли и раздает монетки всем, кто вам понравился.

## Установка

Для работы добробота требуется Node > 7.0 и следующие npm модули

* steem
* dateformat

## Запуск

node . в директории добробота

### Параметры коммандной строки

* -v выводить отладочные сообщения
* -vv выводить отладочные и трассировочные сообщения

## Конфигурация

После первого запуска, добробот создает конфигурационный файл dobrobot.js в 
директории заданной переменной окружения CONFIGDIR или в домашней папке, 
если CONFIGDIR не задана.

## Принцип действия

Вы переводите на счет аккаунта добробота некую сумму добра и в memo 
указываете сколько монеток должен будет добробот переводить автору, 
за которого вы проголосовали (добро за голос). Принимаются так же дробные числа, с точкой 
в качестве разделителя дробной части. 

Если вы проголосовали за того или иного автора, добробот переведет указанную сумму (добро за голос) 
с вашего баланса понравившемуся вам автору.

Баланс добра можно будет пополнять как Голосами (GOLOS), так и Золотыми (GBG). При наличии обоих
валют на вашем балансе добра, будут сначала расходоваться Голоса, а затем Золотые.

При исчерпании баланса добра, вам будут переведены 0.001 в той валюте, 
в которой закончился баланс, а в мемо будет указано, что "баланс добра исчерпан".

Можно приостановить раздачу. Для этого переведите любую (мин. 0.001) сумму в той валюте, 
в которой вы хотите остановить доброту.  В мемо укажите "/стоп". 
Возабновить раздачу можно так же переводом, а в мемо укажите сумму amount per voice или /старт.

## Поддерживаемые комманды

Переведя хотя бы минимальную сумму можно указать в заметке комманду доброботу. 
Можно указыват только одну комманду за перевод. Если вы ошиблись с коммандой, ввели незнакомую боту комманду - ничего страшного, 
бот остановит перревод добра от вашего имени. Еще одним переводом вы можете перенатроить бота. 

Следующиее комманды поддерживаются.

* д/г - добро за голос. Число, с точкой в качестве разделителяя дробной части. Сумма, которую добробот будет переводить за каждый ваш лайк. 
Задав параметр д/г автоматически запускается добробот. Тоесть ет необходимости запускать его вручную. Примеры: "1", "1.1", "0.001" (указывать без ковычек)
* /стоп - остановить раздачу добра
* /старт - возобнавить раздачу добра
* /кит - режим кита, переводимая сумма добра не зависит от силы вашего отданного голоса
* /рыба - режим рыбы, переводимая сумма добра пропорционально зависит от силы вашего отданного голоса
* @username д/г - пополнить балланс добра другому пользователю. Примеры: "@ropox 1.1", "@anyone 0" (указывать без ковычек)





