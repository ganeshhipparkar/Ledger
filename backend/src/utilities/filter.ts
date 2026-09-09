export class Filter {
  /**
   * Build a WHERE clause string from an array of filter objects.
   *
   * @param param   
   * @param alias   
   * @param aliasMap 
   *                 
   * @param condition 
   */
  async makeFilterString(
    param,
    alias,
    aliasMap: Record<string, string> = {},
    condition: 'All' | 'Any' = 'All',
  ) {
    try {
      const join = condition === 'Any' ? ' OR ' : ' AND ';
      let filterString: any = '';

      if (Array.isArray(param)) {
        for (let i = 0; i < param.length; i++) {
          let key = '';
          let operator = '';
          let value = '';

          for (const j in param[i]) {
            if (j === 'key') key = param[i][j];
            if (j === 'operator') operator = param[i][j];
            if (j === 'value') value = param[i][j];
          }

          const clause = await this.filterCondition(
            key,
            operator,
            value,
            alias,
            aliasMap,
          );

          if (filterString !== '') {
            filterString += join + clause;
          } else {
            filterString = clause;
          }
        }
      } else {
        let key = '';
        let operator = '';
        let value = '';

        for (const i in param) {
          if (i === 'key') key = param[i];
          if (i === 'operator') operator = param[i];
          if (i === 'value') value = param[i];
        }

        filterString = await this.filterCondition(
          key,
          operator,
          value,
          alias,
          aliasMap,
        );
      }

      return filterString;
    } catch (err) {
      console.log(err);
    }
  }

  async filterCondition(
    key,
    operator,
    value,
    alias,
    aliasMap: Record<string, string> = {},
  ) {
    try {
      let whereStr = '';
      let symbol = '';
      // Resolve alias for the key if provided in aliasMap
      const resolvedAlias = aliasMap[key] || alias;
      switch (operator) {
        case 'eq':
        case '=':
        case 'equal':
          symbol = '=';
          whereStr +=
            ' ' + `${resolvedAlias + '.' + key} ${symbol}  "${value}"`;
          break;

        case 'greaterThan':
          symbol = '>';
          whereStr +=
            ' ' + `${resolvedAlias + '.' + key} ${symbol}  "${value}"`;
          break;

        case 'smallerThan':
          symbol = '<';
          whereStr +=
            ' ' + `${resolvedAlias + '.' + key} ${symbol}  "${value}"`;
          break;

        case 'begin':
          symbol = 'LIKE';
          whereStr += ' ' + `${resolvedAlias}.${key} ${symbol} "${value}%"`;
          break;

        case 'like':
        case 'contains':
          symbol = 'LIKE';
          whereStr += ' ' + `${resolvedAlias}.${key} ${symbol} "%${value}%"`;
          break;

        case 'end':
          symbol = 'LIKE';
          whereStr += ' ' + `${resolvedAlias}.${key} ${symbol} "%${value}"`;
          break;
      }
      return whereStr;
    } catch (err) {
      return err;
    }
  }

  async calcPages(param?, userEntity?) {
    try {
      const [val, cnt] = await userEntity.findAndCount();
      //console.log(cnt)
      const page = param.page ? parseInt(param.page) : 1;
      const limit = param.limit ? parseInt(param.limit) : 10;
      let skip = 0;
      if (cnt < (page - 1) * limit) {
        skip = cnt - limit - 1;
      } else {
        skip = (page - 1) * limit;
      }
      if (param.page <= 0) {
        skip = 0;
      }
      //console.log(skip,limit)
      return [skip, limit];
    } catch (err) {
      return err;
    }
  }
}
